document.addEventListener("DOMContentLoaded", function () {
    const width = 600, height = 400;
    const margin = { top: 40, right: 40, bottom: 50, left: 70 };

    const scatterSvg = d3.select("#scatterplot").append("svg").attr("width", width).attr("height", height);
    const histWidth = 400, histHeight = 300;
    const inactiveHistSvg = d3.select("#inactive-histogram").append("svg").attr("width", histWidth).attr("height", histHeight);
    const mapSvg = d3.select("#map").append("svg").attr("width", width).attr("height", height);

    let currentAttribute = "percent_inactive"; 
    let filteredData = [];  

    const attributeColors = {
        "percent_inactive": "#64B5F6",
        "percent_coronary_heart_disease": "#E57373",
        "percent_high_cholesterol": "#81C784",
        "percent_smoking": "#FFD54F"
    };

    const attributeNames = {
        "percent_inactive": "Physical Inactivity (%)",
        "percent_coronary_heart_disease": "Heart Disease (%)",
        "percent_high_cholesterol": "Cholesterol (%)",
        "percent_smoking": "Smoking (%)"
    };

    const tooltip = d3.select("body").append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("opacity", 0)
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("font-size", "14px");

    d3.csv("national_health_data_2024.csv").then(data => {
        data.forEach(d => {
            d.id = d.cnty_fips; 
            d.percent_inactive = +d.percent_inactive;
            d.percent_coronary_heart_disease = +d.percent_coronary_heart_disease;
            d.percent_high_cholesterol = +d.percent_high_cholesterol;
            d.percent_smoking = +d.percent_smoking;
        });

        filteredData = data;

        const dropdown = d3.select("#scatter-dropdown");
        Object.keys(attributeNames).forEach(attr => {
            dropdown.append("option").attr("value", attr).text(attributeNames[attr]);
        });

        function updateVisualizations() {
            updateScatterplot();
            updateHistogram(inactiveHistSvg, currentAttribute);
            updateMap();
        }

        function updateScatterplot() {
            const xScale = d3.scaleLinear().domain(d3.extent(data, d => d[currentAttribute])).range([margin.left, width - margin.right]);
            const yScale = d3.scaleLinear().domain(d3.extent(data, d => d.percent_coronary_heart_disease)).range([height - margin.bottom, margin.top]);

            scatterSvg.selectAll("g").remove();

            scatterSvg.append("g").attr("transform", `translate(0, ${height - margin.bottom})`).call(d3.axisBottom(xScale));
            scatterSvg.append("g").attr("transform", `translate(${margin.left}, 0)`).call(d3.axisLeft(yScale));

            scatterSvg.selectAll("circle")
                .data(filteredData)
                .join("circle")
                .attr("cx", d => xScale(d[currentAttribute]))
                .attr("cy", d => yScale(d.percent_coronary_heart_disease))
                .attr("r", 5)
                .attr("fill", attributeColors[currentAttribute])
                .attr("opacity", 0.7)
                .on("mouseover", function (event, d) {
                    tooltip.transition().duration(200).style("opacity", 1);
                    tooltip.html(`${attributeNames[currentAttribute]}: ${d[currentAttribute]}%<br>Heart Disease: ${d.percent_coronary_heart_disease}%`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(500).style("opacity", 0);
                });

            const brush = d3.brush()
                .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
                .on("end", brushedScatter);

            scatterSvg.append("g").call(brush);

            function brushedScatter({ selection }) {
                if (!selection) {
                    filteredData = data; 
                } else {
                    const [[x0, y0], [x1, y1]] = selection;
                    filteredData = data.filter(d =>
                        xScale(d[currentAttribute]) >= x0 && xScale(d[currentAttribute]) <= x1 &&
                        yScale(d.percent_coronary_heart_disease) >= y0 && yScale(d.percent_coronary_heart_disease) <= y1
                    );
                }
                updateVisualizations();
            }
        }

        function updateHistogram(svg, dataKey) {
            svg.selectAll("*").remove();

            const x = d3.scaleLinear().domain(d3.extent(filteredData, d => d[dataKey])).range([0, histWidth - 100]);
            const bins = d3.bin().domain(x.domain()).thresholds(20)(filteredData.map(d => d[dataKey]));
            const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).range([histHeight - 50, 0]);

            const g = svg.append("g").attr("transform", "translate(50,30)");

            g.append("g").attr("transform", `translate(0, ${histHeight - 50})`).call(d3.axisBottom(x));
            g.append("g").call(d3.axisLeft(y));

            g.selectAll("rect")
                .data(bins)
                .join("rect")
                .attr("x", d => x(d.x0))
                .attr("y", d => y(d.length))
                .attr("width", d => x(d.x1) - x(d.x0) - 2)
                .attr("height", d => histHeight - 50 - y(d.length))
                .attr("fill", attributeColors[dataKey])
                .attr("opacity", 0.7)
                .on("mouseover", function (event, d) {
                    tooltip.transition().duration(200).style("opacity", 1);
                    tooltip.html(`Range: ${d.x0.toFixed(1)}% - ${d.x1.toFixed(1)}%<br>Count: ${d.length}`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                })
                .on("mouseout", function () {
                    tooltip.transition().duration(500).style("opacity", 0);
                });
        }

        function updateMap() {
            d3.json("counties-10m.json").then(us => {
                const projection = d3.geoAlbersUsa().fitSize([width, height], topojson.feature(us, us.objects.counties));
                const path = d3.geoPath().projection(projection);

                const colorScale = d3.scaleSequential(d3.interpolateBlues).domain(d3.extent(filteredData, d => d[currentAttribute]));

                mapSvg.selectAll("path")
                    .data(topojson.feature(us, us.objects.counties).features)
                    .join("path")
                    .attr("d", path)
                    .attr("fill", d => {
                        const county = filteredData.find(c => c.id == d.id);
                        return county ? colorScale(county[currentAttribute]) : "#ddd";
                    })
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 0.3);

                const brush = d3.brush()
                    .extent([[0, 0], [width, height]])
                    .on("end", brushedMap);

                mapSvg.append("g").call(brush);

                function brushedMap({ selection }) {
                    if (!selection) {
                        filteredData = data; 
                    } else {
                        const [[x0, y0], [x1, y1]] = selection;
                        filteredData = filteredData.filter(d => {
                            const centroid = path.centroid(d);
                            return centroid[0] >= x0 && centroid[0] <= x1 && centroid[1] >= y0 && centroid[1] <= y1;
                        });
                    }
                    updateVisualizations();
                }
            });
        }

        dropdown.on("change", function () {
            currentAttribute = this.value;
            filteredData = data;
            updateVisualizations();
        });

        updateVisualizations();
    });
});
