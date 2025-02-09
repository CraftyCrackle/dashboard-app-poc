import React, { useState, useEffect } from "react";
import {
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Container,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
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

interface ChartData {
  [key: string]: {
    type: string;
    data: {
      labels: string[];
      datasets: Array<{
        label: string;
        data: number[];
        backgroundColor: string[];
        borderColor: string[];
      }>;
    };
  };
}

interface Chart {
  title: string;
  type: string;
  data_source: string;
  field: string;
  aggregation: string;
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  charts: Chart[];
}

const chartTypes = [
  { value: "line", label: "Line Chart" },
  { value: "bar", label: "Bar Chart" },
  { value: "pie", label: "Pie Chart" },
];

// Sample data for demonstration
const sampleData = {
  industryRevenue: {
    labels: ["Manufacturing", "Healthcare", "Technology", "Retail", "Finance"],
    datasets: [
      {
        label: "Annual Revenue (millions)",
        data: [450, 380, 520, 290, 400],
        backgroundColor: [
          "rgba(255, 99, 132, 0.5)",
          "rgba(54, 162, 235, 0.5)",
          "rgba(255, 206, 86, 0.5)",
          "rgba(75, 192, 192, 0.5)",
          "rgba(153, 102, 255, 0.5)",
        ],
        borderColor: [
          "rgba(255, 99, 132, 1)",
          "rgba(54, 162, 235, 1)",
          "rgba(255, 206, 86, 1)",
          "rgba(75, 192, 192, 1)",
          "rgba(153, 102, 255, 1)",
        ],
        borderWidth: 1,
      },
    ],
  },
  monthlyTrends: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        label: "Manufacturing",
        data: [65, 59, 80, 81, 56, 55],
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
      {
        label: "Healthcare",
        data: [28, 48, 40, 19, 86, 27],
        borderColor: "rgb(54, 162, 235)",
        backgroundColor: "rgba(54, 162, 235, 0.5)",
      },
    ],
  },
  sizeDistribution: {
    labels: ["Small", "Medium", "Large", "Enterprise"],
    datasets: [
      {
        label: "Company Size Distribution",
        data: [30, 45, 15, 10],
        backgroundColor: [
          "rgba(255, 99, 132, 0.5)",
          "rgba(54, 162, 235, 0.5)",
          "rgba(255, 206, 86, 0.5)",
          "rgba(75, 192, 192, 0.5)",
        ],
        borderColor: [
          "rgba(255, 99, 132, 1)",
          "rgba(54, 162, 235, 1)",
          "rgba(255, 206, 86, 1)",
          "rgba(75, 192, 192, 1)",
        ],
        borderWidth: 1,
      },
    ],
  },
  employeeGrowth: {
    labels: ["2019", "2020", "2021", "2022", "2023"],
    datasets: [
      {
        label: "Employee Growth",
        data: [1200, 1350, 1500, 1800, 2100],
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.5)",
        tension: 0.3,
      },
    ],
  },
};

const Dashboard: React.FC = () => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartsData, setChartsData] = useState<{ [key: string]: ChartData }>(
    {}
  );

  useEffect(() => {
    const fetchDashboards = async () => {
      try {
        console.log("Fetching dashboards...");
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No authentication token found");
        }

        const response = await axios.get(`${API_URL}/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("Dashboards response:", response.data);
        setDashboards(response.data);

        // Fetch data for each dashboard
        for (const dashboard of response.data) {
          if (dashboard && dashboard.id) {
            console.log(`Fetching data for dashboard ${dashboard.id}...`);
            const dataResponse = await axios.get(
              `${API_URL}/dashboard/${dashboard.id}/data`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            console.log(`Dashboard ${dashboard.id} data:`, dataResponse.data);
            setChartsData((prev) => ({
              ...prev,
              [dashboard.id]: dataResponse.data,
            }));
          }
        }
      } catch (err: any) {
        console.error("Error fetching dashboards:", err);
        setError(err.response?.data?.message || "Failed to fetch dashboards");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboards();
  }, []);

  const renderChart = (chartType: string, chartData: any) => {
    console.log("Rendering chart:", { type: chartType, data: chartData });
    const ChartComponent = {
      line: Line,
      bar: Bar,
      pie: Pie,
    }[chartType.toLowerCase()];

    if (!ChartComponent) {
      console.warn(`Unsupported chart type: ${chartType}`);
      return (
        <Typography color="error">
          Unsupported chart type: {chartType}
        </Typography>
      );
    }

    return <ChartComponent data={chartData} />;
  };

  if (loading) {
    return (
      <Container
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "80vh",
        }}
      >
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!dashboards || dashboards.length === 0) {
    return (
      <Container>
        <Alert severity="info">
          No dashboards found. Create a new dashboard to get started.
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      {dashboards.map(
        (dashboard) =>
          dashboard && (
            <Paper key={dashboard.id} sx={{ p: 3, mb: 3 }}>
              <Typography variant="h5" gutterBottom>
                {dashboard.name}
              </Typography>
              {dashboard.description && (
                <Typography variant="body2" color="text.secondary" paragraph>
                  {dashboard.description}
                </Typography>
              )}

              <Grid container spacing={3}>
                {dashboard.charts &&
                  dashboard.charts.map((chart, index) => (
                    <Grid item xs={12} md={6} lg={4} key={index}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>
                          {chart.title}
                        </Typography>
                        {chartsData[dashboard.id]?.[chart.title] ? (
                          renderChart(
                            chartsData[dashboard.id][chart.title].type,
                            chartsData[dashboard.id][chart.title].data
                          )
                        ) : (
                          <CircularProgress />
                        )}
                      </Paper>
                    </Grid>
                  ))}
              </Grid>
            </Paper>
          )
      )}
    </Container>
  );
};

export default Dashboard;
