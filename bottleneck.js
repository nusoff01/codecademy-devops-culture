const numStations = 8;
const bottleneckIndex = 3;
const normalTime = 1000;
const bottleneckTime = 5000;
const stationWidth = 40;
const stationsYOffset = 20;
const stationsXOffset = 20;

const legendBlockHeight = 16;

const widgetRadius = stationWidth / 3;

let currWidgetIndex = 0;

const PROCESSING_STATES = {
    WORKING: 'working',
    EMPTY: 'empty',
    BLOCKED: 'blocked'
};

const legendTextMap = {
    working: 'working',
    empty: 'empty',
    blocked: 'blocked by bottleneck'
}

function createArc (percentageComplete) {
    const finishAngle = percentageComplete * Math.PI * 2;
    return d3.arc()
        .outerRadius(widgetRadius)
        .innerRadius(0)
        .startAngle(0)
        .endAngle(finishAngle);
}

function drawStations (svg, stationsData) {
    if (svg.selectAll('.cdc-stations-group').empty()) {
        svg.append('g')
            .attr('class', 'cdc-stations-group');
    }

    const stationsGroup = svg.select('.cdc-stations-group')
        .attr('transform', `translate(${stationsXOffset},${stationsYOffset})`);

    const stations = stationsGroup.selectAll('.cdc-station')
        .data(stationsData);
    stations.enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', (station, stationIndex) => getStationY(stationIndex))
        .attr('width', stationWidth)
        .attr('height', stationWidth)
        .merge(stations)
        .attr('class', (d, i) => `cdc-station cdc-fill-${d.processingState}`);

    stations.exit().remove();
}

function getStationY (stationIndex) {
    return stationIndex * (stationWidth * 1.5);
}

function drawWidgets (stationsGroup, widgetsState) {
    const widgets = stationsGroup.selectAll('.cdc-widget-group')
        .data(widgetsState, (widget) => widget.widgetIndex);
    widgets.enter()
        .append('g')
        .attr('class', 'cdc-widget-group')
        .merge(widgets)
        .each(function (widget) {
            const outerCircle = d3.select(this).selectAll('.cdc-widget-outer-circle')
                .data([widget]);
            outerCircle.enter()
                .append('circle')
                .attr('class', 'cdc-widget-outer-circle')
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('r', widgetRadius);
            outerCircle.exit().remove();

            const arc = d3.select(this).selectAll('.cdc-widget-progress')
                .data([widget]);
            arc.enter()
                .append('path')
                .attr('class', 'cdc-widget-progress')
                .merge(arc)
                .filter((widget) => {
                    return widget.elapsedProcessingTime === 0;
                })
                .transition()
                .ease(d3.easeSin)
                .duration((widget) => widget.station === bottleneckIndex ? bottleneckTime : normalTime)
                .attrTween("d", (widget) => {
                    const widgetDuration = widget.station === bottleneckIndex ? bottleneckTime : normalTime
                    const elapsedOffset = Math.min(widget.elapsedProcessingTime / widgetDuration, 1);
                    const startAngle = (widget.station + elapsedOffset) / numStations;
                    const endAngle = (widget.station + 1) / numStations;
                    var i = d3.interpolate(startAngle, endAngle);
                    return function (t) {
                        return createArc(i(t))();
                    }
                });

        
            arc.exit().remove();
        })
        .transition()
        .duration(100)
        .attr("transform", (widget) => `translate(${stationWidth / 2},${getStationY(widget.station) + stationWidth / 2})`)

    widgets.exit().remove();    
}

function runSimulation (svg) {
    let widgetsState = [];
    for (var i = -6; i < 0; i++) {
        widgetsState.push({
            station: i,
            elapsedProcessingTime: 0,
            widgetIndex: currWidgetIndex
        });
        currWidgetIndex += 1;
    }

    function initializeStationsData () {
        let stationsData = [];
        for (var i = 0; i < numStations; i++) {
            stationsData.push({
                isBottleneck: i !== bottleneckIndex,
                processingTime: i !== bottleneckIndex ? normalTime : bottleneckTime,
                processingState: PROCESSING_STATES.EMPTY
            });
        }    
        return stationsData;
    }
    let stationsData = initializeStationsData();

    
    function updateState (widgetsState) {
        const currentStationState = {};
        widgetsState.reverse().forEach((widgetState, i) => {
            widgetState.elapsedProcessingTime += normalTime;
            if (widgetState.station === bottleneckIndex) {
                if (!(widgetState.elapsedProcessingTime === bottleneckTime)) {
                    return;
                }
            }
            // check to see if next space is available, or if next space will be complete
            if (widgetsState[i - 1]?.station !== widgetState.station + 1 || widgetState.station >= numStations - 1) {
                widgetState.elapsedProcessingTime = 0;
                widgetState.station = widgetState.station + 1;    
            }
        });

        widgetsState = widgetsState.filter((widgetState) => {
            return widgetState.station <= numStations;
        });

        //hardcoded right now, replenishment 
        if (widgetsState.length < 6) {
            widgetsState.push({station: -2, elapsedProcessingTime: 0, widgetIndex: currWidgetIndex});
            currWidgetIndex += 1;
        }
        return widgetsState.reverse();
    }

    function updateStations (stationsData, widgetsState) {
        stationsData = initializeStationsData();
        widgetsState.forEach((widget) => {
            if (widget.station >= 0 && widget.station < numStations) {
                stationsData[widget.station].processingState = 
                    widget.elapsedProcessingTime >= stationsData[widget.station].processingTime ?
                        PROCESSING_STATES.BLOCKED :
                        PROCESSING_STATES.WORKING;
            }
        });
        return stationsData;
    }

    function draw (stationsData, widgetsState) {
        drawStations(svg, stationsData);
        const stationsGroup = svg.select('.cdc-stations-group');
        drawWidgets(stationsGroup, widgetsState);
    }

    draw(stationsData, widgetsState);
    return setInterval(() => {
        widgetsState = updateState(widgetsState);
        stationsData = updateStations(stationsData, widgetsState);
        draw(stationsData, widgetsState);
    }, normalTime);
}

// EXECUTION
let simulation;

function renderBottleneck () {
    const container = d3.select('#cdc-container');
    if (container.selectAll('svg').empty()) {
        const svg = container.append('svg')
            .attr('class', 'cdc-svg');
    }
    const svg = container.select('.cdc-svg');

    // color legend
    const colorsData = Object.values(PROCESSING_STATES);
    const legendGroup = svg.selectAll('.cdc-color-legend')
        .data([colorsData]);
    legendGroup.enter()
        .append('g')
        .attr('class', 'cdc-color-legend')
        .merge(legendGroup)
        .attr('transform', 'translate(360,220)') //TODO make this aligned to right
        .each(function (colorsData) {
            const colorGroups = d3.select(this).selectAll('.cdc-color-group')
                .data(colorsData);
            colorGroups.enter()
                .append('g')
                .attr('class', 'cdc-color-group')
                .attr('transform', (d, i) => `translate(0, ${i * 24})`)
                .each(function (colorGroup) {
                    const colorText = d3.select(this).selectAll('.cdc-color-text')
                        .data([colorGroup]);
                    colorText.enter()
                        .append('text')
                        .attr('class', 'cdc-color-text')
                        .attr('y', '-3')
                        .text(colorGroupName => legendTextMap[colorGroupName]);
                    colorText.exit().remove();

                    const colorBlock = d3.select(this).selectAll('.cdc-color-block')
                        .data([colorGroup]);
                    colorBlock.enter()
                        .append('rect')
                        .attr('x', 8)
                        .attr('y', -legendBlockHeight)
                        .attr('width', legendBlockHeight)
                        .attr('height', legendBlockHeight)
                        .merge(colorBlock)
                        .attr('class', (colorGroupName) => `cdc-color-block cdc-fill-${colorGroupName}`);
                    colorBlock.exit().remove();
                });
            colorGroups.exit().remove();
        })
    legendGroup.exit().remove();

    // processing times labels

    const processingTimesData = [];
    for (var i = 0; i <= numStations; i++) {
        processingTimesData.push((i === bottleneckIndex) ? bottleneckTime / 1000 : normalTime / 1000);
    }

    const processingTimeTexts = svg.selectAll('cdc-processing-time-text')
        .data(processingTimesData);
    processingTimeTexts.enter()
        .append('text')
        .merge(processingTimeTexts)
        .attr('x', `${stationsXOffset + stationWidth + 8}`)
        .attr('y', (d, i) => `${getStationY(i) + stationWidth + stationsYOffset - 4}`)
        .classed('cdc-is-bottleneck', (d, i) => i === bottleneckIndex)
        .text((d) => `${d} second${d === 1 ? '' : 's'}`);
    processingTimeTexts.exit().remove();

    return runSimulation(svg);
}

simulation = renderBottleneck(); // make sure to clear this if running again