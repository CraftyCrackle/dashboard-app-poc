import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  MenuItem,
  TextField,
  Button,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
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
}

const Data: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<GridColDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchDataSources();
  }, []);

  const fetchDataSources = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get(`${API_URL}/data/sources`, {
        withCredentials: true,
      });
      setDataSources(response.data);
      setLoading(false);
    } catch (err: any) {
      console.error("Error fetching data sources:", err);
      setError(err.response?.data?.message || "Error fetching data sources");
      setLoading(false);
    }
  };

  const initializeSampleData = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/data/sample-data`, null, {
        withCredentials: true,
      });
      await fetchDataSources();
      setSuccess("Sample data initialized successfully!");
    } catch (err: any) {
      console.error("Error initializing sample data:", err);
      setError(err.response?.data?.message || "Error initializing sample data");
    } finally {
      setLoading(false);
    }
  };

  const fetchSourceData = async (sourceId: string) => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get(
        `${API_URL}/data/source/${sourceId}/data`,
        {
          withCredentials: true,
        }
      );

      // Transform the data for DataGrid
      const data = response.data;
      console.log("Received data:", data); // Debug log

      if (data && data.length > 0) {
        // Extract columns from the first record
        const firstRecord = data[0].data;
        console.log("First record data:", firstRecord); // Debug log

        if (!firstRecord || typeof firstRecord !== "object") {
          throw new Error("Invalid data format received from server");
        }

        const gridColumns: GridColDef[] = Object.keys(firstRecord).map(
          (key) => ({
            field: key,
            headerName:
              key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
            flex: 1,
            minWidth: 150,
          })
        );

        // Transform data into rows with unique IDs
        const gridRows = data.map((record: any, index: number) => ({
          id: record.id || index,
          ...record.data,
        }));

        console.log("Transformed columns:", gridColumns); // Debug log
        console.log("Transformed rows:", gridRows); // Debug log

        setColumns(gridColumns);
        setRows(gridRows);
      } else {
        setColumns([]);
        setRows([]);
        setError("No data available for this source");
      }
      setLoading(false);
    } catch (err: any) {
      console.error("Error fetching source data:", err);
      console.error("Error details:", err.response?.data); // Debug log
      setError(
        err.response?.data?.message || err.message || "Failed to fetch data"
      );
      setColumns([]);
      setRows([]);
      setLoading(false);
    }
  };

  const handleSourceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sourceId = event.target.value;
    setSelectedSource(sourceId);
    if (sourceId) {
      fetchSourceData(sourceId);
    } else {
      setColumns([]);
      setRows([]);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Raw Data
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        {dataSources.length === 0 && !loading && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              No data sources available. You can initialize sample data to see
              how the dashboard works.
            </Alert>
            <Button
              variant="contained"
              onClick={initializeSampleData}
              disabled={loading}
            >
              Initialize Sample Data
            </Button>
          </Box>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          select
          fullWidth
          label="Select Data Source"
          value={selectedSource}
          onChange={handleSourceChange}
          sx={{ mb: 2 }}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {dataSources.map((source) => (
            <MenuItem key={source.id} value={source.id}>
              {source.name} ({source.record_count} records)
            </MenuItem>
          ))}
        </TextField>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ height: 600, width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              initialState={{
                pagination: {
                  paginationModel: {
                    pageSize: 10,
                  },
                },
              }}
              pageSizeOptions={[10, 25, 50, 100]}
              disableRowSelectionOnClick
              density="compact"
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Data;
