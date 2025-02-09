import React, { useState, useEffect } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Pie } from "react-chartjs-2";
import axios from "axios";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Get API URL from window.env or fallback to environment variable
const API_URL =
  (window as any).env?.REACT_APP_API_URL || process.env.REACT_APP_API_URL;

interface EmbeddableChartProps {
  chartId: string;
  height?: number;
  width?: number;
}

const EmbeddableChart: React.FC<EmbeddableChartProps> = ({
  chartId,
  height = 400,
  width = "100%",
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(
          `${API_URL}/dashboard/public/chart/${chartId}`
        );
        setChartData(response.data);
      } catch (err: any) {
        console.error("Error fetching chart data:", err);
        setError(err.response?.data?.message || "Failed to load chart");
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [chartId]);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height={height}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !chartData) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height={height}
      >
        <Typography color="error">{error || "Failed to load chart"}</Typography>
      </Box>
    );
  }

  const chartProps = {
    data: chartData.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top" as const,
        },
        title: {
          display: true,
          text: chartData.title,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  };

  return (
    <Box height={height} width={width}>
      {(() => {
        switch (chartData.type.toLowerCase()) {
          case "line":
            return <Line {...chartProps} />;
          case "bar":
            return <Bar {...chartProps} />;
          case "pie":
            return <Pie {...chartProps} />;
          default:
            return (
              <Typography color="error">
                Unsupported chart type: {chartData.type}
              </Typography>
            );
        }
      })()}
    </Box>
  );
};

export default EmbeddableChart;
