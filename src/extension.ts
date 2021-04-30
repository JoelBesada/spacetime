import * as vscode from 'vscode';
import * as path from 'path';
import inlinedScript from './inlinedScript';

const WORK_SPACE_TIMES_STORAGE_KEY = 'workspaceTimes';
const MAX_IDLE_TIME_SECONDS = 60 * 15;

type WorkspaceEvent = {
	timestamp: number,
	type: 'opened' | 'saved' | 'closed'
};
type WorkspaceTimes = {
	[workspaceName: string]: {
		[date: string]: number // Time in seconds
	}
};

const workspaceEvents: {
	[workspaceName: string]: WorkspaceEvent[]
} = {};

export function activate(context: vscode.ExtensionContext) {
	context.globalState.setKeysForSync([WORK_SPACE_TIMES_STORAGE_KEY]);

	vscode.workspace.workspaceFolders?.forEach(({name}) => {
		workspaceEvents[name] = [
			{timestamp: Date.now(), type: 'opened'}
		];
	});

	vscode.workspace.onDidSaveTextDocument((document) => {
		const maxIdleTimeSeconds = vscode.workspace.getConfiguration('spacetime').maxIdleMinutes * 60 || MAX_IDLE_TIME_SECONDS;
		if (document.uri.scheme === "file") {
			const savedWorkspace = vscode.workspace.getWorkspaceFolder(document.uri);
			if (savedWorkspace) {
				const {name} = savedWorkspace;
				workspaceEvents[name] = workspaceEvents[name] || [];
				const prevEvent = workspaceEvents[name][workspaceEvents[name].length - 1];
				workspaceEvents[name].push({timestamp: Date.now(), type: 'saved'});
				if (prevEvent) {
					const workTimeSeconds = Math.min(maxIdleTimeSeconds, (Date.now() - prevEvent.timestamp) / 1000);
					const workspaceTimes = context.globalState.get<WorkspaceTimes>(WORK_SPACE_TIMES_STORAGE_KEY, {});
					const date = new Date().toISOString().split('T')[0];
					workspaceTimes[name] = workspaceTimes[name] || {};
					workspaceTimes[name][date] = (workspaceTimes[name][date] || 0) + workTimeSeconds;

					context.globalState.update('workspaceTimes', workspaceTimes);
				}
			}
		}	
	});

	let disposable = vscode.commands.registerCommand('spacetime.viewStats', () => {
		const panel = vscode.window.createWebviewPanel(
			'spacetime-stats',
			'Spacetime Stats',
			vscode.ViewColumn.One,
			{
				enableScripts: true
			}
		);

		const dayInMilliseconds = 1000 * 60 * 60 * 24;
		const today = new Date(Date.now()).toISOString().split('T')[0];
		const sevenDaysAgo = new Date(Date.now() - dayInMilliseconds * 7).toISOString().split('T')[0];

		const logoURI = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'assets', 'Logo.png')));

		panel.webview.html = `<!DOCTYPE html>
		<html lang="en">
		<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Spacetime Stats</title>
				<style>
					h1 {
						font-size: 2.5em;
					}
					h2 {
						font-size: 1.75em;
					}

					input, select {
						background: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						outline: none;
						border: none;
						box-shadow: none;
						padding: 0.5em;
					}

					select {
						appearance: none;
						padding: 0.7em 0.5em;
						min-width: 80px;
					}

					.select-wrapper {
						display: inline-block;
						position: relative;
					}
					.select-wrapper:after {
						content: '';
						display: block;
						position: absolute;
						background: var(--vscode-input-foreground);
						width: 0.7em;
						height: 0.4em;
						top: 50%;
						right: 0.7em;
						margin-top: -0.2em;
						clip-path: polygon(100% 0%, 0 0%, 50% 100%);
					}

					input[type="date"]::-webkit-calendar-picker-indicator {
						filter: invert(1);
					}

					.vscode-light input, .vscode-light select {
						border: 1px solid #ccc;
					}

					.vscode-light input[type="date"]::-webkit-calendar-picker-indicator {
						filter: none;
					}

					.vscode-high-contrast input, .vscode-high-contrast select {
						border: 1px solid white;
					}

					.heading {
						display: flex;
						flex-wrap: wrap;
						justify-content: space-between;
						align-items: center;
						margin: 20px 0;
					}

					.date-inputs input {
            margin: 0 0.25em;
					}

					.input-container {
						padding: 1em 0.5em;
					}

					.heading h1 {
						margin: 0;
					}

					.header-wrapper {
						display: flex;
						align-items: center;
					}

					.header-wrapper img {
						width: 80px;
						height: 80px;
						margin-right: 1em;
					}

					.chart-section {
						max-width: 1200px;
						padding-bottom: 40px;
					}

					thead {
						background: rgba(100, 100, 100, 0.25);
						border-bottom: 1px solid rgba(100, 100, 100, 0.5);
					}
					tbody tr {
						background: rgba(100, 100, 100, 0.10);
					}
					tbody tr:nth-child(2n) {
						background: rgba(100, 100, 100, 0.25);
					}
					th, td {
							text-align: left;
							min-width: 200px;
							padding: 1em 1em;
					}
					th:not(:last-child), td:not(:last-child) {
						border-right: 1px solid rgba(100, 100, 100, 0.5);
					}

					.vscode-light thead {
						background: rgba(100, 100, 100, 0.1);
						border-bottom: 1px solid rgba(100, 100, 100, 0.25);
					}

					.vscode-light tbody tr {
						background: rgba(100, 100, 100, 0.03);
					}
					.vscode-light tbody tr:nth-child(2n) {
						background: rgba(100, 100, 100, 0.1);
					}
			
					.vscode-light th:not(:last-child), .vscode-light td:not(:last-child) {
						border-right: 1px solid rgba(100, 100, 100, 0.25);
					}

					table {
							border-collapse: collapse;
							font-size: 16px;
							width: 100%;
							max-width: 800px;
					}

					.workspace-color {
						display: inline-block;
						width: 14px;
						height: 14px;
						margin-right: 0.25em;
						vertical-align: middle;
					}
				</style>
		</head>
		<body>
		  <div class="heading">
				<div class="header-wrapper">
					<img src="${logoURI}" />
					<h1>Spacetime Stats</h1>
				</div>	
				<div class="input-container">
					<div class="date-inputs">
						From
						<input type="date" id="start" name="start" value=${sevenDaysAgo} max=${today}>
						to
						<input type="date" id="end" name="end" value=${today} max=${today}>
						<div class="select-wrapper"><select id="group">
							<option value="daily" selected>Daily</option>
							<option value="weekly">Weekly</option>
							<option value="monthly">Monthly</option>
							<option value="yearly">Yearly</option>
						</select></div>
					</div>
				</div>
		  </div>
      <section class="chart-section">
				<canvas id="chart"></canvas>
			</section>
      <section class="totals-section">
				<h2>Totals</h2>
				<table>
				  <thead>
					  <tr>
						  <th>Workspace</th>
							<th>Time Spent</th>
						</tr>
					</thead>
					<tbody id="table-body">
					</tbody>
				</table>
			</section>

			<script src="https://cdn.jsdelivr.net/npm/chart.js@3.2.0/dist/chart.min.js"></script>
			<script>
				window.workspaceTimes = ${JSON.stringify(context.globalState.get(WORK_SPACE_TIMES_STORAGE_KEY, {}))}
			</script>
			<script>
				${inlinedScript.toString().split('\n').slice(1, -1).join('\n')}
			</script>
		</body>
		</html>`;
	});

	context.subscriptions.push(disposable);
}

