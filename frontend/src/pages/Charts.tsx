import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Container,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Tooltip,
  Snackbar,
  MenuItem,
} from "@mui/material";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Pie } from "react-chartjs-2";
import axios from "axios";
import {
  Edit as EditIcon,
  Search as SearchIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Code as CodeIcon,
  ContentCopy as ContentCopyIcon,
  Add as AddIcon,
} from "@mui/icons-material";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend
);

// Get API URL from window.env or fallback to environment variable
const API_URL =
  (window as any).env?.REACT_APP_API_URL || process.env.REACT_APP_API_URL;

interface Dashboard {
  id: string;
  name: string;
  description: string;
  charts: Chart[];
}

interface Chart {
  title: string;
  type: string;
  data_source: string;
  x_axis: string;
  y_axis: string;
  aggregation: string;
}

interface ChartData {
  type: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
    }>;
  };
}

interface EditDialogData {
  dashboardId: string;
  chartTitle: string;
  labels: string[];
  data: number[];
}

interface DeleteDialogData {
  dashboardId: string;
  chartTitle: string;
}

interface EmbedDialogData {
  dashboardId: string;
  chartTitle: string;
}

interface DataSource {
  id: string;
  name: string;
  description: string;
  type: string;
  columns: string[];
}

const Charts: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<{
    [key: string]: { [key: string]: ChartData };
  }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<EditDialogData | null>(null);
  const [editedData, setEditedData] = useState<{ x: string; y: number }[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingChart, setDeletingChart] = useState<DeleteDialogData | null>(
    null
  );
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
  const [embedChart, setEmbedChart] = useState<EmbedDialogData | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [createChartDialogOpen, setCreateChartDialogOpen] = useState(false);
  const [newChartData, setNewChartData] = useState({
    title: "",
    type: "bar",
    data_source: "",
    x_axis: "",
    y_axis: "",
    aggregation: "none",
  });
  const chartRefs = useRef<{ [key: string]: any }>({});
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedDataSource, setSelectedDataSource] =
    useState<DataSource | null>(null);

  useEffect(() => {
    fetchDashboardData();
    fetchDataSources();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await axios.get(`${API_URL}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const dashboards: Dashboard[] = response.data;
      const chartData: { [key: string]: { [key: string]: ChartData } } = {};

      // Fetch data for each dashboard
      for (const dashboard of dashboards) {
        try {
          const dataResponse = await axios.get(
            `${API_URL}/dashboard/${dashboard.id}/data`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          chartData[dashboard.id] = dataResponse.data;
        } catch (err) {
          console.error(
            `Error fetching data for dashboard ${dashboard.id}:`,
            err
          );
        }
      }

      setDashboardData(chartData);
    } catch (err: any) {
      console.error("Error fetching dashboards:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to fetch dashboard data"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchDataSources = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const response = await axios.get(`${API_URL}/data/sources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDataSources(response.data);
    } catch (err) {
      console.error("Error fetching data sources:", err);
    }
  };

  const handleDataSourceChange = (sourceId: string) => {
    const source = dataSources.find((s) => s.id === sourceId);
    setSelectedDataSource(source || null);
    setNewChartData({
      ...newChartData,
      data_source: sourceId,
      x_axis: "", // Reset x_axis when data source changes
      y_axis: "", // Reset y_axis when data source changes
    });
  };

  const handleEditClick = (
    dashboardId: string,
    chartTitle: string,
    chartData: ChartData
  ) => {
    const labels = chartData.data.labels;
    const data = chartData.data.datasets[0].data;
    setEditingChart({ dashboardId, chartTitle, labels, data });
    setEditedData(
      labels.map((label, index) => ({
        x: label,
        y: data[index],
      }))
    );
    setEditDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setEditingChart(null);
    setEditedData([]);
  };

  const handleDataPointChange = (
    index: number,
    field: "x" | "y",
    value: string
  ) => {
    const newData = [...editedData];
    if (field === "x") {
      newData[index] = { ...newData[index], x: value };
    } else {
      newData[index] = { ...newData[index], y: parseFloat(value) || 0 };
    }
    setEditedData(newData);
  };

  const handleSaveChanges = async () => {
    if (!editingChart) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const updatedChartData = {
        ...dashboardData[editingChart.dashboardId][editingChart.chartTitle],
        data: {
          labels: editedData.map((point) => point.x),
          datasets: [
            {
              ...dashboardData[editingChart.dashboardId][
                editingChart.chartTitle
              ].data.datasets[0],
              data: editedData.map((point) => point.y),
            },
          ],
        },
      };

      // Update the chart data in the state
      setDashboardData((prev) => ({
        ...prev,
        [editingChart.dashboardId]: {
          ...prev[editingChart.dashboardId],
          [editingChart.chartTitle]: updatedChartData,
        },
      }));

      // Close the dialog
      handleEditDialogClose();
    } catch (err: any) {
      console.error("Error saving chart data:", err);
      setError("Failed to save chart data changes");
    }
  };

  const handleDeleteClick = (dashboardId: string, chartTitle: string) => {
    setDeletingChart({ dashboardId, chartTitle });
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setDeletingChart(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingChart) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      // Send delete request to backend
      await axios.delete(
        `${API_URL}/dashboard/${
          deletingChart.dashboardId
        }/chart/${encodeURIComponent(deletingChart.chartTitle)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Update local state
      setDashboardData((prev) => {
        const newData = { ...prev };
        if (newData[deletingChart.dashboardId]) {
          const { [deletingChart.chartTitle]: _, ...remainingCharts } =
            newData[deletingChart.dashboardId];
          newData[deletingChart.dashboardId] = remainingCharts;
        }
        return newData;
      });

      handleDeleteDialogClose();
    } catch (err: any) {
      console.error("Error deleting chart:", err);
      setError("Failed to delete chart");
    }
  };

  const handleDownloadChart = (dashboardId: string, chartTitle: string) => {
    const chartRef = chartRefs.current[`${dashboardId}-${chartTitle}`];
    if (!chartRef) return;

    try {
      // Get the chart canvas
      const canvas = chartRef.canvas;

      // Create a temporary link element
      const link = document.createElement("a");
      link.download = `${chartTitle.replace(/\s+/g, "_")}.png`;

      // Get the canvas data URL in PNG format
      link.href = canvas.toDataURL("image/png");

      // Trigger the download
      link.click();
    } catch (err) {
      console.error("Error downloading chart:", err);
      setError("Failed to download chart as PNG");
    }
  };

  const handleEmbedClick = (dashboardId: string, chartTitle: string) => {
    setEmbedChart({ dashboardId, chartTitle });
    setEmbedDialogOpen(true);
  };

  const handleEmbedDialogClose = () => {
    setEmbedDialogOpen(false);
    setEmbedChart(null);
  };

  const getEmbedCode = () => {
    if (!embedChart) return "";

    // Create a base64 encoded string of the chart info
    const chartInfo = {
      d: embedChart.dashboardId,
      c: embedChart.chartTitle,
    };
    const chartId = btoa(JSON.stringify(chartInfo));

    // Generate the iframe code
    return `<iframe 
  src="${window.location.origin}/embed/chart/${chartId}"
  width="100%" 
  height="400" 
  frameborder="0"
  style="border: 1px solid #eee; border-radius: 4px;"
></iframe>`;
  };

  const handleCopyCode = async () => {
    const code = getEmbedCode();
    await navigator.clipboard.writeText(code);
    setCopySuccess(true);
  };

  const handleCreateChart = () => {
    setCreateChartDialogOpen(true);
  };

  const handleCreateChartClose = () => {
    setCreateChartDialogOpen(false);
    setNewChartData({
      title: "",
      type: "bar",
      data_source: "",
      x_axis: "",
      y_axis: "",
      aggregation: "none",
    });
  };

  const handleCreateChartSubmit = async () => {
    try {
      const selectedSource = dataSources.find(
        (s) => s.id === newChartData.data_source
      );
      if (!selectedSource) {
        setError("Selected data source not found");
        return;
      }

      const response = await axios.post(
        `${API_URL}/dashboard`,
        {
          name: "Default Dashboard",
          description: "Created from Charts page",
          charts: [
            {
              title: newChartData.title,
              type: newChartData.type,
              data_source: selectedSource.name,
              config: {
                group_by: `${newChartData.x_axis}`,
                measure: `${newChartData.y_axis}`,
                aggregate:
                  newChartData.aggregation === "none"
                    ? null
                    : newChartData.aggregation,
              },
            },
          ],
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      setCreateChartDialogOpen(false);
      fetchDashboardData(); // Refresh the charts list
    } catch (error) {
      console.error("Error creating chart:", error);
      setError("Failed to create chart. Please try again.");
    }
  };

  const renderChart = (
    chartType: string,
    chartData: ChartData["data"],
    dashboardId: string,
    chartTitle: string
  ) => {
    const chartKey = `${dashboardId}-${chartTitle}`;
    const chartProps = {
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top" as const,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
      ref: (ref: any) => (chartRefs.current[chartKey] = ref),
    };

    return (
      <Box
        sx={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            mb: 1,
            gap: 1,
            bgcolor: "background.default",
            p: 1,
            borderRadius: 1,
          }}
        >
          <IconButton
            size="small"
            onClick={() => handleEmbedClick(dashboardId, chartTitle)}
            title="Get Embed Code"
            sx={{
              bgcolor: "background.paper",
              "&:hover": {
                bgcolor: "action.hover",
              },
            }}
          >
            <CodeIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDownloadChart(dashboardId, chartTitle)}
            title="Download as PNG"
            sx={{
              bgcolor: "background.paper",
              "&:hover": {
                bgcolor: "action.hover",
              },
            }}
          >
            <DownloadIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() =>
              handleEditClick(dashboardId, chartTitle, {
                type: chartType,
                data: chartData,
              })
            }
            sx={{
              bgcolor: "background.paper",
              "&:hover": {
                bgcolor: "action.hover",
              },
            }}
          >
            <EditIcon />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteClick(dashboardId, chartTitle)}
            sx={{
              bgcolor: "background.paper",
              "&:hover": {
                bgcolor: "error.lighter",
              },
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          {(() => {
            switch (chartType.toLowerCase()) {
              case "line":
                return <Line {...chartProps} />;
              case "bar":
                return <Bar {...chartProps} />;
              case "pie":
                return <Pie {...chartProps} />;
              default:
                console.warn(`Unsupported chart type: ${chartType}`);
                return (
                  <Typography color="error">
                    Unsupported chart type: {chartType}
                  </Typography>
                );
            }
          })()}
        </Box>
      </Box>
    );
  };

  if (loading) {
    return (
      <Container>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "50vh",
          }}
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  const dashboardIds = Object.keys(dashboardData);
  if (dashboardIds.length === 0) {
    return (
      <Container>
        <Alert severity="info" sx={{ mt: 2 }}>
          No charts available. Create a dashboard with charts to see them here.
        </Alert>
      </Container>
    );
  }

  const filteredDashboards = dashboardIds.filter((dashboardId) =>
    Object.keys(dashboardData[dashboardId]).some((chartTitle) =>
      chartTitle.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <Container>
      <Box sx={{ p: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Typography variant="h4" gutterBottom>
            Charts
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateChart}
            sx={{ mb: 1 }}
          >
            Add Chart
          </Button>
        </Box>

        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search charts by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />
            ),
          }}
          sx={{ mb: 3 }}
        />

        {filteredDashboards.map((dashboardId) => {
          const charts = dashboardData[dashboardId];
          const filteredCharts = Object.entries(charts).filter(([chartTitle]) =>
            chartTitle.toLowerCase().includes(searchTerm.toLowerCase())
          );

          return (
            <Grid container spacing={3} key={dashboardId}>
              {filteredCharts.map(([chartTitle, chartData], index) => (
                <Grid item xs={12} md={6} key={`${dashboardId}-${index}`}>
                  <Paper
                    sx={{
                      p: 2,
                      display: "flex",
                      flexDirection: "column",
                      height: 400,
                      "&:hover .chart-actions": {
                        opacity: 1,
                      },
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      {chartTitle}
                    </Typography>
                    {renderChart(
                      chartData.type,
                      chartData.data,
                      dashboardId,
                      chartTitle
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          );
        })}

        <Dialog
          open={editDialogOpen}
          onClose={handleEditDialogClose}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Edit Chart Data</DialogTitle>
          <DialogContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>X Axis (Label)</TableCell>
                    <TableCell>Y Axis (Value)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editedData.map((point, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          fullWidth
                          value={point.x}
                          onChange={(e) =>
                            handleDataPointChange(index, "x", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          type="number"
                          value={point.y}
                          onChange={(e) =>
                            handleDataPointChange(index, "y", e.target.value)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleEditDialogClose}>Cancel</Button>
            <Button onClick={handleSaveChanges} variant="contained">
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteDialogClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Delete Chart</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this chart? This action cannot be
              undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteDialogClose}>Cancel</Button>
            <Button
              onClick={handleDeleteConfirm}
              variant="contained"
              color="error"
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={embedDialogOpen}
          onClose={handleEmbedDialogClose}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Embed Chart</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Copy the code below to embed this chart in your website or
              application:
            </Typography>
            <Box
              sx={{
                position: "relative",
                bgcolor: "grey.100",
                p: 2,
                borderRadius: 1,
                fontFamily: "monospace",
                fontSize: "0.875rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {getEmbedCode()}
              <IconButton
                onClick={handleCopyCode}
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                }}
                size="small"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleEmbedDialogClose}>Close</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={copySuccess}
          autoHideDuration={3000}
          onClose={() => setCopySuccess(false)}
          message="Embed code copied to clipboard"
        />

        <Dialog open={createChartDialogOpen} onClose={handleCreateChartClose}>
          <DialogTitle>Create New Chart</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Chart Title"
              value={newChartData.title}
              onChange={(e) =>
                setNewChartData({ ...newChartData, title: e.target.value })
              }
              margin="normal"
            />
            <TextField
              select
              fullWidth
              label="Chart Type"
              value={newChartData.type}
              onChange={(e) =>
                setNewChartData({ ...newChartData, type: e.target.value })
              }
              margin="normal"
            >
              <MenuItem value="bar">Bar Chart</MenuItem>
              <MenuItem value="line">Line Chart</MenuItem>
              <MenuItem value="pie">Pie Chart</MenuItem>
            </TextField>
            <TextField
              select
              fullWidth
              label="Data Source"
              value={newChartData.data_source}
              onChange={(e) => handleDataSourceChange(e.target.value)}
              margin="normal"
            >
              <MenuItem value="">
                <em>Select a data source</em>
              </MenuItem>
              {dataSources.map((source) => (
                <MenuItem key={source.id} value={source.id}>
                  {source.name} ({source.type})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="X-Axis Field"
              value={newChartData.x_axis}
              onChange={(e) =>
                setNewChartData({ ...newChartData, x_axis: e.target.value })
              }
              margin="normal"
              disabled={!selectedDataSource}
            >
              <MenuItem value="">
                <em>Select X-Axis field</em>
              </MenuItem>
              {selectedDataSource?.columns.map((column) => (
                <MenuItem key={column} value={column}>
                  {column}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="Y-Axis Field"
              value={newChartData.y_axis}
              onChange={(e) =>
                setNewChartData({ ...newChartData, y_axis: e.target.value })
              }
              margin="normal"
              disabled={!selectedDataSource}
            >
              <MenuItem value="">
                <em>Select Y-Axis field</em>
              </MenuItem>
              {selectedDataSource?.columns.map((column) => (
                <MenuItem key={column} value={column}>
                  {column}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="Aggregation"
              value={newChartData.aggregation}
              onChange={(e) =>
                setNewChartData({
                  ...newChartData,
                  aggregation: e.target.value,
                })
              }
              margin="normal"
            >
              <MenuItem value="none">No Aggregation</MenuItem>
              <MenuItem value="sum">Sum</MenuItem>
              <MenuItem value="avg">Average</MenuItem>
              <MenuItem value="count">Count</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCreateChartClose}>Cancel</Button>
            <Button
              onClick={handleCreateChartSubmit}
              variant="contained"
              disabled={
                !newChartData.title ||
                !newChartData.data_source ||
                !newChartData.x_axis ||
                !newChartData.y_axis
              }
            >
              Create
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Charts;
