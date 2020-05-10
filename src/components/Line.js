import React, { useMemo, useState, useRef, useLayoutEffect, useEffect } from 'react';
import classNames from 'classnames';

import { prerenderLine } from '../prerender';
import Train from './Train';
import { PopoverContainerContext, getTrainRoutePairsForLine } from './util';

const abbreviateStationName = station =>
    station
        .replace('Boston College', 'B.C.')
        .replace('Hynes Convention Center', 'Hynes')
        .replace('Heath Street', 'Heath');

const renderViewboxForBounds = bounds => {
    const { top, bottom, left, right } = bounds;
    const paddingTop = 5;
    const paddingBottom = 10;
    const paddingX = 50;
    const width = right - left + paddingX * 2;
    const height = bottom - top + paddingTop + paddingBottom;
    const minX = left - paddingX;
    const minY = top - paddingTop;
    return `${minX} ${minY} ${width} ${height}`;
};

const sortTrainRoutePairsByDistance = (pairs, stationPositions) => {
    const distanceMap = new Map(
        pairs.map(pair => {
            const { train } = pair;
            const station = stationPositions[train.stationId];
            if (station) {
                const { x, y } = station;
                const distance = Math.sqrt(x ** 2 + y ** 2);
                return [pair, distance];
            }
            return [pair, 0];
        })
    );
    return pairs.sort((a, b) => distanceMap.get(a) - distanceMap.get(b));
};

const findClosestStationToTop = stationPositions => {
    const { closestId } = Object.entries(stationPositions).reduce(
        ({ closestId, shortestDistance }, [nextId, nextPosition]) => {
            const { x, y } = nextPosition;
            const nextDistance = Math.sqrt(x ** 2 + y ** 2);
            if (nextDistance < shortestDistance) {
                return {
                    closestId: nextId,
                    shortestDistance: nextDistance,
                };
            }
            return { closestId, shortestDistance };
        },
        { closestId: null, shortestDistance: Infinity }
    );
    return closestId;
};

const renderRelativeStyles = ({ width, height }) => {
    if (width > height) {
        return { width: '100%' };
    }
    return { height: '100%' };
};

const renderContainerStyles = lineOffset => {
    if (lineOffset !== null) {
        const negativeOffset = 0 - lineOffset;
        return {
            transform: `translateX(calc(${negativeOffset}px + 40vw))`,
        };
    }
    return {};
};

const Line = props => {
    const { api, line, style } = props;
    const { getStationLabelPosition, shouldLabelTrain } = line;
    const { stationsByRoute, trainsByRoute, routesInfo } = api;
    const [lineOffset, setLineOffset] = useState(null);
    const [shouldFocusOnFirstTrain, setShouldFocusOnFirstTrain] = useState(true);
    const firstStationRef = useRef(null);

    const colors = {
        lines: 'white',
        newTrains: line.color,
        background: line.colorSecondary,
    };

    const [container, setContainer] = useState(null);

    const { pathDirective, bounds, routes, stationPositions, stations } = useMemo(
        () => prerenderLine(line, stationsByRoute, routesInfo),
        [line, stationsByRoute, routesInfo]
    );

    const trainRoutePairs = getTrainRoutePairsForLine(trainsByRoute, routes);
    const hasTrains = trainRoutePairs.length > 0;

    const viewbox = renderViewboxForBounds(bounds, {
        paddingX: 500,
        paddingY: 5,
    });

    useLayoutEffect(() => {
        const { current: firstStation } = firstStationRef;
        if (firstStation) {
            const { x } = firstStation.getBoundingClientRect();
            setLineOffset(x);
        }
    }, []);

    useEffect(() => {
        setShouldFocusOnFirstTrain(!hasTrains);
    }, [hasTrains]);

    const renderLine = () => {
        return <path d={pathDirective} stroke={colors.lines} fill="transparent" />;
    };

    const renderStations = () => {
        const closestId = findClosestStationToTop(stationPositions);
        return Object.entries(stationPositions).map(([stationId, pos]) => {
            const labelPosition = getStationLabelPosition(stationId);
            const stationName =
                stations[stationId] && abbreviateStationName(stations[stationId].name);
            const refProps = stationId === closestId ? { ref: firstStationRef } : {};

            const label = labelPosition && stationName && (
                <text
                    aria-hidden="true"
                    fontSize={4}
                    fill={colors.lines}
                    textAnchor={labelPosition === 'right' ? 'start' : 'end'}
                    x={labelPosition === 'right' ? 4 : -4}
                    y={1.5}
                >
                    {stationName}
                </text>
            );

            return (
                <g key={stationId} transform={`translate(${pos.x}, ${pos.y})`} {...refProps}>
                    <circle cx={0} cy={0} r={1} fill={colors.lines} />
                    {label}
                </g>
            );
        });
    };

    const renderTrains = () => {
        return sortTrainRoutePairsByDistance(
            trainRoutePairs,
            stationPositions
        ).map(({ train, route }, index) => (
            <Train
                focusOnMount={shouldFocusOnFirstTrain && index === 0}
                key={train.label}
                train={train}
                route={route}
                colors={colors}
                alwaysLabelTrain={shouldLabelTrain(train)}
            />
        ));
    };

    if (trainRoutePairs.length === 0) {
        return (
            <div className="line-pane empty">
                <div className="empty-notice">
                    {line.name === 'Red'
                        ? 'New Red Line trains are expected later in 2020.'
                        : `No new trains on the ${line.name} Line right now.`}
                </div>
            </div>
        );
    }

    return (
        <div
            role="list"
            aria-label={`New trains on the ${line.name} Line`}
            ref={setContainer}
            className={classNames('line-pane', line.name.toLowerCase())}
            style={{ ...renderContainerStyles(lineOffset), ...style }}
        >
            <PopoverContainerContext.Provider value={container}>
                <svg viewBox={viewbox} style={renderRelativeStyles(viewbox)}>
                    {renderLine()}
                    {renderStations()}
                    {renderTrains()}
                </svg>
            </PopoverContainerContext.Provider>
        </div>
    );
};

export default Line;
