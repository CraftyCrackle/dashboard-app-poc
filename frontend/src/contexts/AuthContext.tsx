import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

// Configure axios defaults
axios.defaults.withCredentials = true;

// Get API URL from window.env or fallback to environment variable
const API_URL =
  (window as any).env?.REACT_APP_API_URL ||
  process.env.REACT_APP_API_URL ||
  "http://localhost";
axios.defaults.baseURL = API_URL;

interface User {
  email: string;
  name: string;
  organization: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  organization: string;
  role: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log("Initial auth check - Token exists:", !!token);
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      const response = await axios.get(`/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      localStorage.removeItem("token");
      delete axios.defaults.headers.common["Authorization"];
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log("Attempting login at:", `/auth/login`);
      const response = await axios.post(`/auth/login`, {
        email,
        password,
      });

      console.log("Login successful");
      const { access_token, user: userData } = response.data;
      localStorage.setItem("token", access_token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
    setIsAuthenticated(false);
  };

  const register = async (userData: RegisterData) => {
    try {
      const response = await axios.post(`/auth/register`, userData);

      const { access_token } = response.data;
      localStorage.setItem("token", access_token);

      await fetchUserProfile();
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
