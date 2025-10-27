async function createChart(cloudId, containerId, lineColor) {
    try {
        const response = await fetch(`/api/telemetry/${cloudId}`);
        const data = await response.json();

        if (!data || !data.length) return;

        am4core.useTheme(am4themes_animated);

        const chart = am4core.create(containerId, am4charts.XYChart);
        chart.data = data.map(d => ({ time: d.time, value: d.value }));

        const categoryAxis = chart.xAxes.push(new am4charts.CategoryAxis());
        categoryAxis.dataFields.category = "time";
        categoryAxis.renderer.labels.template.rotation = 315;

        const valueAxis = chart.yAxes.push(new am4charts.ValueAxis());

        const series = chart.series.push(new am4charts.LineSeries());
        series.dataFields.valueY = "value";
        series.dataFields.categoryX = "time";
        series.stroke = am4core.color(lineColor);
        series.strokeWidth = 2;

        chart.cursor = new am4charts.XYCursor();
        chart.logo.disabled = true;

    } catch (err) {
        console.error(`Error creating chart ${containerId}:`, err);
    }
}


