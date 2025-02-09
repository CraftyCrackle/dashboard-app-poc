import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Box,
} from "@mui/material";
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

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

const API_URL = window.env?.REACT_APP_API_URL || process.env.REACT_APP_API_URL;

const Dashboard = () => {
  const [dataSources, setDataSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [charts, setCharts] = useState([]);

  useEffect(() => {
    fetchDataSources();
  }, []);

  const fetchDataSources = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/data/sources`, {
        withCredentials: true,
      });
      setDataSources(response.data);

      // For each data source, fetch its data and create charts
      for (const source of response.data) {
        await fetchDataAndCreateCharts(source);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching data sources:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchDataAndCreateCharts = async (source) => {
    try {
      const response = await axios.get(
        `${API_URL}/data/source/${source._id}/data`,
        {
          withCredentials: true,
        }
      );

      const data = response.data;
      if (!data || data.length === 0) return;

      // Create charts based on the data structure
      const newCharts = [];

      // Example: Create a bar chart for total income by industry
      if (data[0].data.industry_name_ANZSIC && data[0].data.value) {
        const industryData = data.reduce(
          (acc, record) => {
            if (record.data.variable === "Total income") {
              acc.labels.push(record.data.industry_name_ANZSIC);
              acc.values.push(record.data.value);
            }
            return acc;
          },
          { labels: [], values: [] }
        );

        if (industryData.labels.length > 0) {
          newCharts.push({
            type: "bar",
            data: {
              labels: industryData.labels,
              datasets: [
                {
                  label: "Total Income by Industry",
                  data: industryData.values,
                  backgroundColor: "rgba(54, 162, 235, 0.5)",
                  borderColor: "rgba(54, 162, 235, 1)",
                  borderWidth: 1,
                },
              ],
            },
            options: {
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: {
                  display: true,
                  text: "Total Income by Industry",
                },
              },
            },
          });
        }
      }

      setCharts((prevCharts) => [...prevCharts, ...newCharts]);
    } catch (err) {
      console.error("Error fetching data for source:", err);
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container>
        <Typography color="error" variant="h6">
          Error: {error}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {charts.map((chart, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Paper
              sx={{
                p: 2,
                display: "flex",
                flexDirection: "column",
                height: 400,
              }}
            >
              {chart.type === "bar" && (
                <Bar data={chart.data} options={chart.options} />
              )}
              {chart.type === "line" && (
                <Line data={chart.data} options={chart.options} />
              )}
              {chart.type === "pie" && (
                <Pie data={chart.data} options={chart.options} />
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default Dashboard;
