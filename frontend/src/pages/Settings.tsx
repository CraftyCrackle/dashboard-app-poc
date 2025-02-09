import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Chip,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Tooltip,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from "@mui/material";
import { DataGrid, GridColDef, GridValueGetterParams } from "@mui/x-data-grid";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Group as GroupIcon,
  VpnKey as ApiKeyIcon,
  History as HistoryIcon,
  Notifications as NotificationsIcon,
  Storage as StorageIcon,
  Download as DownloadIcon,
  CloudUpload as CloudUploadIcon,
  PersonAdd as PersonAddIcon,
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Get API URL from window.env or fallback to environment variable
const API_URL =
  (window as any).env?.REACT_APP_API_URL || process.env.REACT_APP_API_URL;

interface ApiEndpoint {
  id: string;
  name: string;
  endpoint: string;
  method: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used: string;
  is_active: boolean;
}

interface AuditLogEntry {
  id: string;
  action: string;
  performed_by: string;
  timestamp: string;
  details: string;
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    organization: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiEndpoints, setApiEndpoints] = useState<ApiEndpoint[]>([]);
  const [retentionSettings, setRetentionSettings] = useState({
    dataRetentionDays: 30,
    archiveEnabled: false,
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    slackNotifications: false,
    slackWebhookUrl: "",
  });
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [dailyReports, setDailyReports] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState("80");
  const [alertRecipients, setAlertRecipients] = useState("");
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const navigate = useNavigate();

  // API Endpoints state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<ApiEndpoint | null>(
    null
  );
  const [endpointForm, setEndpointForm] = useState({
    name: "",
    endpoint: "",
    method: "POST",
    description: "",
    is_active: true,
  });

  // Team members state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");

  // API Keys state
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiration, setNewKeyExpiration] = useState("never");
  const [newKeyValue, setNewKeyValue] = useState("");

  // Data Retention state
  const [retentionPeriod, setRetentionPeriod] = useState("365");
  const [archiveData, setArchiveData] = useState(true);
  const [automaticCleanup, setAutomaticCleanup] = useState(true);

  // Audit log state
  const [auditLogFilter, setAuditLogFilter] = useState("all");

  useEffect(() => {
    fetchApiEndpoints();
    fetchTeamMembers();
    fetchApiKeys();
    fetchRetentionSettings();
    fetchNotificationSettings();
    fetchAuditLog();
  }, []);

  const fetchApiEndpoints = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const response = await axios.get(
        `${API_URL}/auth/profile/api-endpoints`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setApiEndpoints(response.data.endpoints);
    } catch (err: any) {
      console.error("Error fetching API endpoints:", err);
      setError(err.response?.data?.message || "Error fetching API endpoints");
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const response = await axios.get(`${API_URL}/auth/team-members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTeamMembers(response.data.members);
    } catch (err: any) {
      console.error("Error fetching team members:", err);
      setError(err.response?.data?.message || "Failed to load team members");
    }
  };

  const fetchApiKeys = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const response = await axios.get(`${API_URL}/auth/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setApiKeys(response.data.keys);
    } catch (err: any) {
      console.error("Error fetching API keys:", err);
      setError(err.response?.data?.message || "Failed to load API keys");
    }
  };

  const fetchRetentionSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const response = await axios.get(`${API_URL}/auth/settings/retention`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRetentionPeriod(response.data.dataRetentionPeriod);
      setArchiveData(response.data.archiveData);
      setAutomaticCleanup(response.data.automaticCleanup);
    } catch (err: any) {
      console.error("Error fetching retention settings:", err);
      setError(
        err.response?.data?.message || "Failed to load retention settings"
      );
    }
  };

  const fetchNotificationSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const response = await axios.get(
        `${API_URL}/auth/settings/notifications`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setEmailNotifications(response.data.emailNotifications);
      setDailyReports(response.data.dailyReports);
      setAlertThreshold(response.data.alertThreshold);
      setAlertRecipients(response.data.alertRecipients);
    } catch (err: any) {
      console.error("Error fetching notification settings:", err);
      setError(
        err.response?.data?.message || "Failed to load notification settings"
      );
    }
  };

  const fetchAuditLog = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const response = await axios.get(
        `${API_URL}/auth/audit-log?type=${auditLogFilter}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setAuditLog(response.data.entries);
    } catch (err: any) {
      console.error("Error fetching audit log:", err);
      setError(err.response?.data?.message || "Failed to load audit log");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEndpointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked } = e.target;
    setEndpointForm((prev) => ({
      ...prev,
      [name]: name === "is_active" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      await axios.put(
        `${API_URL}/auth/profile`,
        {
          name: formData.name,
          organization: formData.organization,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setSuccess("Profile updated successfully");
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError(err.response?.data?.message || "Failed to update profile");
    }
  };

  const handleEndpointSubmit = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      if (editingEndpoint) {
        // Update existing endpoint
        await axios.put(
          `${API_URL}/auth/profile/api-endpoints/${editingEndpoint.id}`,
          endpointForm,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } else {
        // Create new endpoint
        await axios.post(
          `${API_URL}/auth/profile/api-endpoints`,
          endpointForm,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }

      setSuccess("API endpoint saved successfully");
      setDialogOpen(false);
      fetchApiEndpoints();
    } catch (err: any) {
      console.error("Error saving API endpoint:", err);
      setError(err.response?.data?.message || "Error saving API endpoint");
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      await axios.delete(`${API_URL}/auth/profile/api-endpoints/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess("API endpoint deleted successfully");
      fetchApiEndpoints();
    } catch (err: any) {
      console.error("Error deleting API endpoint:", err);
      setError(err.response?.data?.message || "Error deleting API endpoint");
    }
  };

  const handleEditEndpoint = (endpoint: ApiEndpoint) => {
    setEditingEndpoint(endpoint);
    setEndpointForm({
      name: endpoint.name,
      endpoint: endpoint.endpoint,
      method: endpoint.method,
      description: endpoint.description,
      is_active: endpoint.is_active,
    });
    setDialogOpen(true);
  };

  const handleAddEndpoint = () => {
    setEditingEndpoint(null);
    setEndpointForm({
      name: "",
      endpoint: "",
      method: "POST",
      description: "",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleInviteTeamMember = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      await axios.post(
        `${API_URL}/auth/team-members`,
        {
          email: newMemberEmail,
          name: newMemberName,
          role: newMemberRole,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess("Team member invited successfully");
      setInviteDialogOpen(false);
      fetchTeamMembers();
    } catch (err: any) {
      console.error("Error inviting team member:", err);
      setError(err.response?.data?.message || "Failed to invite team member");
    }
  };

  const handleGenerateApiKey = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const response = await axios.post(
        `${API_URL}/auth/api-keys`,
        {
          name: newKeyName,
          expiration: newKeyExpiration,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setNewKeyValue(response.data.key);
      setSuccess("API key generated successfully");
      fetchApiKeys();
    } catch (err: any) {
      console.error("Error generating API key:", err);
      setError(err.response?.data?.message || "Failed to generate API key");
    }
  };

  const handleSaveRetentionSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      await axios.put(
        `${API_URL}/auth/settings/retention`,
        {
          dataRetentionPeriod: retentionPeriod,
          archiveData,
          automaticCleanup,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess("Retention settings updated successfully");
    } catch (err: any) {
      console.error("Error updating retention settings:", err);
      setError(
        err.response?.data?.message || "Failed to update retention settings"
      );
    }
  };

  const handleSaveNotificationSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      await axios.put(
        `${API_URL}/auth/settings/notifications`,
        {
          emailNotifications,
          dailyReports,
          alertThreshold,
          alertRecipients,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess("Notification settings updated successfully");
    } catch (err: any) {
      console.error("Error updating notification settings:", err);
      setError(
        err.response?.data?.message || "Failed to update notification settings"
      );
    }
  };

  const handleCopyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setSuccess("API key copied to clipboard!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleToggleApiKey = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const response = await axios.put(
        `${API_URL}/auth/profile/api-keys/${id}/toggle`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.is_active) {
        setSuccess("API key activated successfully");
      } else {
        setSuccess("API key deactivated successfully");
      }
      fetchApiKeys();
    } catch (err) {
      console.error("Error toggling API key:", err);
      setError("Failed to toggle API key");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await axios.get(
        `${API_URL}/auth/team-members/template`,
        {
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        }
      );

      // Create a blob from the response data
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "user_upload_template.xlsx");
      document.body.appendChild(link);
      link.click();

      // Clean up
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Error downloading template:", err);
      setError(
        err.response?.data?.message ||
          "Failed to download template. Please try again."
      );
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files?.length) return;

    const file = event.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        `${API_URL}/auth/team-members/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setSuccess(`Successfully uploaded ${response.data.processed} users`);
      fetchTeamMembers(); // Refresh the team members list
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to upload users");
    }

    // Reset the file input
    event.target.value = "";
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      await axios.put(
        `${API_URL}/auth/profile/change-password`,
        {
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setPasswordSuccess("Password updated successfully");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      // Close the dialog after a short delay
      setTimeout(() => {
        setPasswordDialogOpen(false);
        setPasswordSuccess("");
      }, 2000);
    } catch (err: any) {
      console.error("Error changing password:", err);
      setPasswordError(
        err.response?.data?.message || "Failed to update password"
      );
    }
  };

  // Add columns definition after the interfaces
  const teamColumns: GridColDef[] = [
    { field: "name", headerName: "Name", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "role", headerName: "Role", flex: 1 },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={params.value === "active" ? "success" : "default"}
          size="small"
        />
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Settings
      </Typography>

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

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="settings tabs"
        >
          <Tab label="Profile" icon={<SettingsIcon />} iconPosition="start" />
          <Tab label="Team" icon={<GroupIcon />} iconPosition="start" />
          <Tab label="API" icon={<ApiKeyIcon />} iconPosition="start" />
          <Tab label="Security" icon={<StorageIcon />} iconPosition="start" />
          <Tab
            label="Notifications"
            icon={<NotificationsIcon />}
            iconPosition="start"
          />
          <Tab label="Audit Log" icon={<HistoryIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Profile Settings Tab */}
      <TabPanel value={tabValue} index={0}>
        <Typography variant="h6" gutterBottom>
          Profile Settings
        </Typography>
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
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              margin="normal"
            />
            <TextField
              fullWidth
              label="Organization"
              value={formData.organization}
              onChange={(e) =>
                setFormData({ ...formData, organization: e.target.value })
              }
              margin="normal"
            />
            <Button
              variant="contained"
              color="primary"
              onClick={() => setPasswordDialogOpen(true)}
              sx={{ mt: 2 }}
            >
              Change Password
            </Button>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Team Management Tab */}
      <TabPanel value={tabValue} index={1}>
        <Typography variant="body1" color="text.secondary" paragraph>
          Manage your team members, send invitations, and handle bulk user
          uploads.
        </Typography>
        <Card>
          <CardHeader title="Team Members" avatar={<GroupIcon />} />
          <CardContent>
            <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={() => setInviteDialogOpen(true)}
              >
                Invite Member
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
              >
                Download Template
              </Button>
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUploadIcon />}
              >
                Upload Users
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                />
              </Button>
            </Stack>

            <Box sx={{ height: 400, width: "100%" }}>
              <DataGrid
                rows={teamMembers}
                columns={teamColumns}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 5, page: 0 },
                  },
                }}
                pageSizeOptions={[5, 10, 20]}
                checkboxSelection
                disableRowSelectionOnClick
                autoHeight
              />
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      {/* API Management Tab */}
      <TabPanel value={tabValue} index={2}>
        <Typography variant="body1" color="text.secondary" paragraph>
          Configure API endpoints and manage API keys for external integrations.
        </Typography>
        <Grid container spacing={3}>
          {/* Existing API Endpoints and API Keys content */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="API Endpoints"
                avatar={<StorageIcon />}
                action={
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddEndpoint}
                  >
                    Add Endpoint
                  </Button>
                }
              />
              <CardContent>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Endpoint</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {apiEndpoints.map((endpoint) => (
                        <TableRow key={endpoint.id}>
                          <TableCell>{endpoint.name}</TableCell>
                          <TableCell>{endpoint.endpoint}</TableCell>
                          <TableCell>
                            <Chip
                              label={endpoint.method}
                              color={
                                endpoint.method === "GET"
                                  ? "primary"
                                  : "secondary"
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={endpoint.is_active}
                              onChange={() => handleEditEndpoint(endpoint)}
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Edit">
                              <IconButton
                                onClick={() => handleEditEndpoint(endpoint)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                onClick={() =>
                                  handleDeleteEndpoint(endpoint.id)
                                }
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="API Keys"
                avatar={<ApiKeyIcon />}
                action={
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleGenerateApiKey}
                  >
                    Generate Key
                  </Button>
                }
              />
              <CardContent>
                <List>
                  {apiKeys.map((key) => (
                    <ListItem key={key.id}>
                      <ListItemText
                        primary={key.name}
                        secondary={`Created: ${new Date(
                          key.created_at
                        ).toLocaleDateString()}`}
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Copy API Key">
                          <IconButton onClick={() => handleCopyApiKey(key.key)}>
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                        <Switch
                          checked={key.is_active}
                          onChange={() => handleToggleApiKey(key.id)}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Security & Data Tab */}
      <TabPanel value={tabValue} index={3}>
        <Typography variant="body1" color="text.secondary" paragraph>
          Configure data retention policies and security settings.
        </Typography>
        <Grid container spacing={3}>
          {/* Existing Data Retention content */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                title="Data Retention"
                avatar={<StorageIcon />}
                action={
                  <Button
                    variant="contained"
                    onClick={handleSaveRetentionSettings}
                  >
                    Save
                  </Button>
                }
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Data Retention Period (days)"
                      value={retentionPeriod}
                      onChange={(e) => setRetentionPeriod(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      select
                      label="Archive Strategy"
                      value={archiveData ? "archive" : "delete"}
                      onChange={(e) =>
                        setArchiveData(e.target.value === "archive")
                      }
                    >
                      <MenuItem value="delete">Delete</MenuItem>
                      <MenuItem value="archive">Archive</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Notifications Tab */}
      <TabPanel value={tabValue} index={4}>
        <Typography variant="body1" color="text.secondary" paragraph>
          Customize email notifications and system alerts.
        </Typography>
        <Grid container spacing={3}>
          {/* Existing Notifications content */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="Notifications"
                avatar={<NotificationsIcon />}
                action={
                  <Button
                    variant="contained"
                    onClick={handleSaveNotificationSettings}
                  >
                    Save
                  </Button>
                }
              />
              <CardContent>
                <List>
                  <ListItem>
                    <ListItemText primary="Email Notifications" />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={emailNotifications}
                        onChange={(e) =>
                          setEmailNotifications(e.target.checked)
                        }
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="System Alerts" />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={dailyReports}
                        onChange={(e) => setDailyReports(e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Audit Log Tab */}
      <TabPanel value={tabValue} index={5}>
        <Typography variant="body1" color="text.secondary" paragraph>
          View and monitor system activities and changes.
        </Typography>
        <Grid container spacing={3}>
          {/* Existing Audit Log content */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="Audit Log"
                avatar={<HistoryIcon />}
                action={
                  <IconButton onClick={fetchAuditLog} title="Refresh">
                    <RefreshIcon />
                  </IconButton>
                }
              />
              <CardContent>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Action</TableCell>
                        <TableCell>Performed By</TableCell>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditLog.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.action}</TableCell>
                          <TableCell>{entry.performed_by}</TableCell>
                          <TableCell>
                            {new Date(entry.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>{entry.details}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingEndpoint ? "Edit API Endpoint" : "Add API Endpoint"}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Name"
            name="name"
            value={endpointForm.name}
            onChange={handleEndpointChange}
            sx={{ mb: 2, mt: 2 }}
          />
          <TextField
            fullWidth
            label="Endpoint Path"
            name="endpoint"
            value={endpointForm.endpoint}
            onChange={handleEndpointChange}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            select
            label="HTTP Method"
            name="method"
            value={endpointForm.method}
            onChange={handleEndpointChange}
            sx={{ mb: 2 }}
          >
            {HTTP_METHODS.map((method) => (
              <MenuItem key={method} value={method}>
                {method}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={endpointForm.description}
            onChange={handleEndpointChange}
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={endpointForm.is_active}
                onChange={handleEndpointChange}
                name="is_active"
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEndpointSubmit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
      >
        <DialogTitle>Invite Team Member</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Name"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Email"
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Role"
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleInviteTeamMember} variant="contained">
            Send Invitation
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={apiKeyDialogOpen}
        onClose={() => setApiKeyDialogOpen(false)}
      >
        <DialogTitle>Generate API Key</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            select
            label="Expiration"
            value={newKeyExpiration}
            onChange={(e) => setNewKeyExpiration(e.target.value)}
            margin="normal"
            SelectProps={{
              native: true,
            }}
          >
            <option value="never">Never</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </TextField>
          {newKeyValue && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Your new API key:
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: "grey.100",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {newKeyValue}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => navigator.clipboard.writeText(newKeyValue)}
                >
                  <CopyIcon />
                </IconButton>
              </Paper>
              <Typography variant="caption" color="error">
                Make sure to copy this key now. You won't be able to see it
                again!
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApiKeyDialogOpen(false)}>Close</Button>
          {!newKeyValue && (
            <Button onClick={handleGenerateApiKey} variant="contained">
              Generate
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
      >
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}
          {passwordSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {passwordSuccess}
            </Alert>
          )}
          <Box component="form" onSubmit={handlePasswordChange} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              name="currentPassword"
              label="Current Password"
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  currentPassword: e.target.value,
                })
              }
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="newPassword"
              label="New Password"
              type="password"
              value={passwordData.newPassword}
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  newPassword: e.target.value,
                })
              }
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm New Password"
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  confirmPassword: e.target.value,
                })
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePasswordChange} variant="contained">
            Update Password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
