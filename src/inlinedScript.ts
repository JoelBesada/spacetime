// eslint-disable-next-line @typescript-eslint/naming-convention
export default (document: any, window: any, Chart: any) => {
  const CHART_COLORS = [
    "rgb(250, 211, 144)",
    "rgb(248, 194, 145)",
    "rgb(106, 137, 204)",
    "rgb(130, 204, 221)",
    "rgb(184, 233, 148)",
    "rgb(246, 185, 59)",
    "rgb(229, 80, 57)",
    "rgb(74, 105, 189)",
    "rgb(96, 163, 188)",
    "rgb(120, 224, 143)",
    "rgb(250, 152, 58)",
    "rgb(235, 47, 6)",
    "rgb(30, 55, 153)",
    "rgb(60, 99, 130)",
    "rgb(56, 173, 169)",
    "rgb(229, 142, 38)",
    "rgb(183, 21, 64)",
    "rgb(12, 36, 97)",
    "rgb(10, 61, 98)",
  ];

  const formatTime = (_time: number) => {
    const time = Math.round(_time);
    const hours = Math.floor(time / 60 / 60);
    const minutes = Math.floor((time - hours * 60 * 60) / 60); 
    const seconds = time % 60;
    return [hours, minutes, seconds].map(n => n.toString().padStart(2, '0')).join(':');
  };

  let currentChart: any;
  const renderChart = (startDate: string, endDate: string, group: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    const startTimestamp = +new Date(startDate);
    const endTimestamp = +new Date(endDate);
    const timestamps: number[] = [];

    let currentTimestamp = startTimestamp;
    while (currentTimestamp <= endTimestamp) {
      timestamps.push(currentTimestamp);
      currentTimestamp += 1000 * 60 * 60 * 24;
    }

    const buckets = timestamps.reduce<Record<string, boolean>>((acc, time) => {
      const date = new Date(time).toISOString().split('T')[0];
      const [year, month, day] = date.split('-');
      const groupDate = (() => {
        if (group === 'daily') {return [year, month, day].join('-');};
        if (group === 'weekly') {
          // The week starts on a Monday and I will not be convinced otherwise
          const weekday = (new Date(time).getDay() + 6) % 7;
          return new Date(time - weekday * 1000 * 60 * 60 * 24).toISOString().split('T')[0];
        };
        if (group === 'monthly') {return [year, month].join('-');};
        return year;
      })();
      acc[groupDate] = true;
      return acc;
    }, {});

    const data = {
      labels: Object.keys(buckets).map((bucket) => {
        const isCurrentYear = new Date(bucket).getFullYear() === new Date().getFullYear();
        return (group === 'weekly' ? 'Week of ' : '') + new Date(bucket).toLocaleString('en-US', {
          day: group === 'daily' || group === 'weekly' ? 'numeric' : undefined, 
          month: group === 'yearly' ? undefined : 'short', 
          year: isCurrentYear && group !== 'yearly' ? undefined : 'numeric'
        });
      }),
      datasets: Object.keys(window.workspaceTimes).map((workspace, index) => {
        return {
          label: workspace,
          data: Object.keys(buckets).map((bucket) => {
            return timestamps
              .filter(timestamp => {
                if (group === 'weekly') {
                  const weekday = (new Date(timestamp).getDay() + 6) % 7;
                  return new Date(timestamp - weekday * 1000 * 60 * 60 * 24).toISOString().split('T')[0].indexOf(bucket) === 0;
                }
                return new Date(timestamp).toISOString().split('T')[0].indexOf(bucket) === 0;
              })
              .reduce((acc, timestamp) => {
                acc += window.workspaceTimes[workspace][new Date(timestamp).toISOString().split('T')[0]] || 0;
                return acc;
              }, 0);
          }),
          backgroundColor: CHART_COLORS[(index * 2) % CHART_COLORS.length]
        };
      })
    };
  
    const config = {
      type: 'bar',
      data,
      options: {
        responsive: true,
        scales: {
          x: {
            stacked: true,
          },
          y: {
            stacked: true,
            ticks: {
              callback: (value: number) => {
                return formatTime(value);
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (tooltipItem: any) =>{
                return `${tooltipItem.dataset.label}: ${formatTime(tooltipItem.raw)}`;
              }
            }
          }
        }
      },
    };

    if (currentChart) {
      currentChart.destroy();
    }
  
    currentChart = new Chart(
      document.getElementById('chart'),
      config
    );
  };

  const renderTable = (startDate: string, endDate: string) => {
    const tbody = document.getElementById('table-body');
    const startTimestamp = +new Date(startDate);
    const endTimestamp = +new Date(endDate);
    tbody.innerHTML = '';
    Object.keys(window.workspaceTimes).forEach((workspace, index) => {
      const totalTime = Object.keys(window.workspaceTimes[workspace]).reduce((acc, date) => {
        const time = window.workspaceTimes[workspace][date];
        const timestamp = +new Date(date);
        if (timestamp < startTimestamp || timestamp > endTimestamp) {
          return acc;
        }
        return acc + time;
      }, 0);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="workspace-color" style="background-color: ${CHART_COLORS[(index * 2) % CHART_COLORS.length]}"></div>
          ${workspace}
        </td>
        <td>${formatTime(totalTime)}</td>
      `;
      tbody.appendChild(tr);
    });
  };

  const render = () => {
    const startDate = document.getElementById('start').value;
    const endDate = document.getElementById('end').value;
    const group = document.getElementById('group').value;

    renderChart(startDate, endDate, group);
    renderTable(startDate, endDate);
  };
  
  document.getElementById('start').addEventListener('change', render);
  document.getElementById('end').addEventListener('change', render);
  document.getElementById('group').addEventListener('change', render);
  render();
};