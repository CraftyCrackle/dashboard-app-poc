import React from "react";
import { useParams } from "react-router-dom";
import { Box } from "@mui/material";
import EmbeddableChart from "../components/EmbeddableChart";

const EmbedChart: React.FC = () => {
  const { chartId } = useParams<{ chartId: string }>();

  if (!chartId) {
    return null;
  }

  return (
    <Box sx={{ width: "100%", height: "100vh", p: 0, m: 0 }}>
      <EmbeddableChart chartId={chartId} height={window.innerHeight} />
    </Box>
  );
};

export default EmbedChart;
