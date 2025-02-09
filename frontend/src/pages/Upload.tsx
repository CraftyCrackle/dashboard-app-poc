import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  MenuItem,
} from "@mui/material";
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  BarChart as ChartIcon,
} from "@mui/icons-material";
import axios from "axios";

// Get API URL from window.env or fallback to environment variable
const API_URL =
  (window as any).env?.REACT_APP_API_URL || process.env.REACT_APP_API_URL;

interface DataSource {
  id: string;
  name: string;
  description: string;
  type: string;
  created_at: string;
  record_count: number;
  columns: string[];
  filename?: string;
}

interface ChartConfig {
  title: string;
  type: string;
  xAxis: string;
  yAxis: string;
  aggregation: string;
}

const chartTypes = [
  { value: "bar", label: "Bar Chart" },
  { value: "line", label: "Line Chart" },
  { value: "pie", label: "Pie Chart" },
];

const aggregationTypes = [
  { value: "none", label: "No Aggregation" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "count", label: "Count" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
];

const Upload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dataSource, setDataSource] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<DataSource[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [selectedFileForChart, setSelectedFileForChart] =
    useState<DataSource | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    title: "",
    type: "bar",
    xAxis: "",
    yAxis: "",
    aggregation: "none",
  });
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  const fetchUploadedFiles = async () => {
    try {
      const response = await axios.get(`${API_URL}/data/sources`, {
        withCredentials: true,
      });
      // Filter only file type data sources
      const fileUploads = response.data.filter(
        (source: DataSource) => source.type === "file"
      );
      setUploadedFiles(fileUploads);
    } catch (err: any) {
      console.error("Error fetching uploaded files:", err);
      setError(err.response?.data?.message || "Error fetching uploaded files");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      console.log(
        "Selected file:",
        selectedFile.name,
        "Size:",
        selectedFile.size
      );
      setFile(selectedFile);
    }
  };

  const handleDownload = async (sourceId: string, fileName: string) => {
    try {
      const response = await axios.get(
        `${API_URL}/data/source/${sourceId}/data`,
        {
          withCredentials: true,
        }
      );

      // Convert the data to CSV
      const data = response.data;
      if (data && data.length > 0) {
        const headers = Object.keys(data[0].data).join(",");
        const rows = data.map((record: any) =>
          Object.values(record.data).join(",")
        );
        const csv = [headers, ...rows].join("\n");

        // Create and download the file
        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error("Error downloading file:", err);
      setError(err.response?.data?.message || "Error downloading file");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !dataSource) {
      setError("Please select a file and enter a data source name");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("data_source", dataSource);
    if (description) {
      formData.append("description", description);
    }

    try {
      const response = await axios.post(`${API_URL}/data/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      });

      console.log("Upload response:", response.data);
      setSuccess("File uploaded successfully!");
      setFile(null);
      setDataSource("");
      setDescription("");
      const fileInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      // Refresh the list of uploaded files
      await fetchUploadedFiles();
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(
        err.response?.data?.message || "Error uploading file. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (source: DataSource) => {
    setSelectedSource(source);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setSelectedSource(null);
    setDeleteDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSource) return;

    try {
      setLoading(true);
      setError("");
      await axios.delete(`${API_URL}/data/source/${selectedSource.id}`, {
        withCredentials: true,
      });
      setSuccess("File deleted successfully!");

      // Refresh the list of uploaded files
      await fetchUploadedFiles();
    } catch (err: any) {
      console.error("Error deleting file:", err);
      setError(err.response?.data?.message || "Error deleting file");
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setSelectedSource(null);
    }
  };

  const handleCreateChart = async () => {
    try {
      setLoading(true);
      setError("");

      const dashboardData = {
        name: "Custom Dashboard",
        description: "Dashboard with uploaded data visualization",
        charts: [
          {
            type: chartConfig.type,
            title: chartConfig.title,
            data_source: selectedFileForChart?.name,
            config: {
              xAxis: chartConfig.xAxis,
              yAxis: chartConfig.yAxis,
              group_by: chartConfig.xAxis,
              aggregate: chartConfig.aggregation,
              measure: chartConfig.yAxis,
            },
          },
        ],
      };

      await axios.post(`${API_URL}/dashboard`, dashboardData, {
        withCredentials: true,
      });

      setSuccess("Chart created successfully!");
      setChartDialogOpen(false);
      setChartConfig({
        title: "",
        type: "bar",
        xAxis: "",
        yAxis: "",
        aggregation: "none",
      });
    } catch (err: any) {
      console.error("Error creating chart:", err);
      setError(err.response?.data?.message || "Error creating chart");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChartDialog = (source: DataSource) => {
    setSelectedFileForChart(source);
    setAvailableColumns(source.columns || []);
    setChartDialogOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Upload Data
      </Typography>

      <Paper sx={{ p: 3, mt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              component="label"
              startIcon={<UploadIcon />}
              disabled={loading}
            >
              Choose File
              <input
                type="file"
                hidden
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
              />
            </Button>
            {file && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Selected file: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </Typography>
            )}
          </Box>

          <TextField
            fullWidth
            label="Data Source Name"
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value)}
            required
            disabled={loading}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            disabled={loading}
            sx={{ mb: 2 }}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading || !file || !dataSource}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? "Uploading..." : "Upload"}
          </Button>
        </form>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Uploaded Files
        </Typography>
        {uploadedFiles.length === 0 ? (
          <Alert severity="info">No files have been uploaded yet.</Alert>
        ) : (
          <List>
            {uploadedFiles.map((source, index) => (
              <React.Fragment key={source.id}>
                {index > 0 && <Divider />}
                <ListItem
                  secondaryAction={
                    <Box>
                      <IconButton
                        edge="end"
                        aria-label="create chart"
                        onClick={() => handleOpenChartDialog(source)}
                        sx={{ mr: 1 }}
                      >
                        <ChartIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="download"
                        onClick={() =>
                          handleDownload(
                            source.id,
                            source.filename || `${source.name}.csv`
                          )
                        }
                        sx={{ mr: 1 }}
                      >
                        <DownloadIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleDeleteClick(source)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={source.name}
                    secondary={
                      <>
                        {source.description && (
                          <Typography variant="body2" color="text.secondary">
                            {source.description}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {source.record_count} records • Uploaded on{" "}
                          {new Date(source.created_at).toLocaleDateString()}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      <Dialog
        open={chartDialogOpen}
        onClose={() => setChartDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Chart</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Chart Title"
              value={chartConfig.title}
              onChange={(e) =>
                setChartConfig((prev) => ({ ...prev, title: e.target.value }))
              }
              sx={{ mb: 2 }}
            />

            <TextField
              select
              fullWidth
              label="Chart Type"
              value={chartConfig.type}
              onChange={(e) =>
                setChartConfig((prev) => ({ ...prev, type: e.target.value }))
              }
              sx={{ mb: 2 }}
            >
              {chartTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="X-Axis Column"
              value={chartConfig.xAxis}
              onChange={(e) =>
                setChartConfig((prev) => ({ ...prev, xAxis: e.target.value }))
              }
              sx={{ mb: 2 }}
            >
              {availableColumns.map((column) => (
                <MenuItem key={column} value={column}>
                  {column}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Y-Axis Column"
              value={chartConfig.yAxis}
              onChange={(e) =>
                setChartConfig((prev) => ({ ...prev, yAxis: e.target.value }))
              }
              sx={{ mb: 2 }}
            >
              {availableColumns.map((column) => (
                <MenuItem key={column} value={column}>
                  {column}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Aggregation Method"
              value={chartConfig.aggregation}
              onChange={(e) =>
                setChartConfig((prev) => ({
                  ...prev,
                  aggregation: e.target.value,
                }))
              }
              sx={{ mb: 2 }}
            >
              {aggregationTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChartDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateChart}
            variant="contained"
            disabled={
              !chartConfig.title || !chartConfig.xAxis || !chartConfig.yAxis
            }
          >
            Create Chart
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete "{selectedSource?.name}"? This
            action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Upload;
