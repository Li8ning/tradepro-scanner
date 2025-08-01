'use client';

import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';

interface ChartProps {
  data: { time: string; open: number; high: number; low: number; close: number }[];
  supertrend: { time: string; value: number; color: string }[];
  indicatorLogic: string;
}

const Chart: React.FC<ChartProps> = ({ data, supertrend, indicatorLogic }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const supertrendSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#000000' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: {
          color: 'rgba(70, 130, 180, 0.5)',
        },
        horzLines: {
          color: 'rgba(70, 130, 180, 0.5)',
        },
      },
    });
    chartRef.current = chart;

    candlestickSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    });

    supertrendSeriesRef.current = chart.addLineSeries({
      lineWidth: 2,
    });

    const resizeObserver = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      if (width > 0) {
        chart.resize(width, 500);
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (candlestickSeriesRef.current) {
      const chartData = data
        .map((d) => ({
          ...d,
          time: (new Date(d.time).getTime() / 1000) as UTCTimestamp,
        }))
        .sort((a, b) => a.time - b.time)
        .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time);
      candlestickSeriesRef.current.setData(chartData);
    }
  }, [data]);

  useEffect(() => {
    if (supertrendSeriesRef.current) {
      const supertrendData = supertrend
        .map((s) => ({
          time: (new Date(s.time).getTime() / 1000) as UTCTimestamp,
          value: s.value,
          color: s.color,
        }))
        .sort((a, b) => a.time - b.time)
        .filter((s, i, arr) => i === 0 || s.time !== arr[i - 1].time);

      supertrendSeriesRef.current.setData(supertrendData);
    }
  }, [supertrend]);

  if (data.length === 0) {
    return (
      <div style={{ color: '#ffffff', textAlign: 'center', padding: '20px', backgroundColor: '#1c1c1c', borderRadius: '4px', height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        No chart data available.
      </div>
    );
  }

  return (
    <div>
      <div ref={chartContainerRef} style={{ height: '500px', width: '100%' }} />
      <div style={{ color: '#ffffff', marginTop: '10px', padding: '10px', backgroundColor: '#1c1c1c', borderRadius: '4px' }}>
        {indicatorLogic}
      </div>
    </div>
  );
};

export default Chart;