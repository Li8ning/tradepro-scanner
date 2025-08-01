'use client';

import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';
import { Button, HStack } from '@chakra-ui/react';

interface ChartProps {
  data: { time: string; open: number; high: number; low: number; close: number }[];
  supertrend: { time: string; value: number; color: string }[];
  indicatorLogic: string;
  timeframe: string;
  setTimeframe: (timeframe: string) => void;
}

const Chart: React.FC<ChartProps> = ({ data, supertrend, indicatorLogic, timeframe, setTimeframe }) => {
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
        background: { color: '#ffffff' },
        textColor: '#333333',
      },
      grid: {
        vertLines: {
          color: '#e1e1e1',
        },
        horzLines: {
          color: '#e1e1e1',
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
      console.log(`Timeframe changed to: ${timeframe}. Filtering data.`);
      const now = new Date();
      let startDate = new Date();

      switch (timeframe) {
        case '1M':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case '6M':
          startDate.setMonth(now.getMonth() - 6);
          break;
        case '1Y':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'ALL':
        default:
          startDate = new Date(data[0]?.time || now);
          break;
      }
      
      console.log(`Filtering data from ${startDate.toISOString()}`);

      const filteredData = data.filter(d => new Date(d.time) >= startDate);

      const chartData = filteredData
        .map((d) => ({
          ...d,
          time: (new Date(d.time).getTime() / 1000) as UTCTimestamp,
        }))
        .sort((a, b) => a.time - b.time)
        .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time);
      
      console.log(`Setting chart data with ${chartData.length} points.`);
      candlestickSeriesRef.current.setData(chartData);
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [data, timeframe]);

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
      <div style={{ color: '#333333', textAlign: 'center', padding: '20px', backgroundColor: '#f4f4f4', borderRadius: '4px', height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        No chart data available.
      </div>
    );
  }

  return (
    <div>
      <HStack justify="center" mb={4}>
        {['1M', '6M', '1Y', 'ALL'].map((tf) => (
          <Button
            key={tf}
            size="sm"
            variant={timeframe === tf ? 'solid' : 'outline'}
            colorScheme="blue"
            onClick={() => {
              console.log(`Timeframe button clicked: ${tf}`);
              setTimeframe(tf);
            }}
          >
            {tf}
          </Button>
        ))}
      </HStack>
      <div ref={chartContainerRef} style={{ height: '500px', width: '100%' }} />
      <div style={{ color: '#333333', marginTop: '10px', padding: '10px', backgroundColor: '#f4f4f4', borderRadius: '4px' }}>
        {indicatorLogic}
      </div>
    </div>
  );
};

export default Chart;