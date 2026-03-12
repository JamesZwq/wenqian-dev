"use client";

import { useState } from "react";

export default function RefreshButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // 重新加载页面以获取最新数据
      window.location.reload();
    } catch (error) {
      console.error("Refresh failed:", error);
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        style={{
          padding: "8px 16px",
          backgroundColor: isLoading ? "#ccc" : "#0066cc",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: isLoading ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: "500",
          transition: "all 0.2s",
          opacity: isLoading ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            (e.target as HTMLButtonElement).style.backgroundColor = "#0052a3";
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading) {
            (e.target as HTMLButtonElement).style.backgroundColor = "#0066cc";
          }
        }}
      >
        {isLoading ? "刷新中..." : "🔄 刷新表单"}
      </button>
      {lastRefreshed && (
        <span style={{ fontSize: "12px", color: "#666" }}>
          最后刷新: {lastRefreshed}
        </span>
      )}
    </div>
  );
}
