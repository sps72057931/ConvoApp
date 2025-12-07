import React, { useState } from "react";
import { FaFileWord } from "react-icons/fa6";
import axios from "axios";

function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [convert, setConvert] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext !== "doc" && ext !== "docx") {
        setDownloadError("Please select a valid Word document (.doc or .docx)");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setConvert("");
      setDownloadError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setDownloadError("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setIsLoading(true);
    setConvert("");
    setDownloadError("");

    try {
      // Get API URL from environment variable
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

      console.log("Sending request to:", `${apiUrl}/convertFile`);

      const response = await axios.post(`${apiUrl}/convertFile`, formData, {
        responseType: "blob",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 60000, // 60 seconds timeout for production
        withCredentials: false,
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        selectedFile.name.replace(/\.[^/.]+$/, "") + ".pdf"
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSelectedFile(null);
      setConvert("File converted successfully! ✓");

      // Reset file input
      const fileInput = document.getElementById("FileInput");
      if (fileInput) fileInput.value = "";

      // Clear success message after 5 seconds
      setTimeout(() => {
        setConvert("");
      }, 5000);
    } catch (error) {
      console.error("Conversion error:", error);

      if (error.response) {
        // Server responded with error
        if (error.response.data instanceof Blob) {
          // Convert blob to text to read error message
          try {
            const text = await error.response.data.text();
            const errorData = JSON.parse(text);
            setDownloadError(errorData.message || "Error converting file");
          } catch {
            setDownloadError("Error converting file. Please try again.");
          }
        } else {
          setDownloadError(
            error.response.data.message || "Error converting file"
          );
        }
      } else if (error.request) {
        // Request made but no response
        setDownloadError(
          "Cannot connect to server. Please check your internet connection and try again."
        );
      } else {
        // Other errors
        setDownloadError("Error: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-screen-2xl mx-auto container px-6 py-3 md:px-40">
        <div className="flex h-screen items-center justify-center">
          <div className="border-2 border-dashed px-4 py-2 md:px-8 md:py-6 border-indigo-400 rounded-lg shadow-lg">
            <h1 className="text-3xl font-bold text-center mb-4">
              Convert Word to PDF Online
            </h1>
            <p className="text-sm text-center mb-5">
              Easily convert Word documents to PDF format online, without having
              to install any software.
            </p>

            <div className="flex flex-col items-center space-y-4">
              <input
                type="file"
                accept=".doc,.docx"
                onChange={handleFileChange}
                className="hidden"
                id="FileInput"
                disabled={isLoading}
              />

              <label
                htmlFor="FileInput"
                className={`w-full flex items-center justify-center px-4 py-6 bg-gray-100 text-gray-700 rounded-lg shadow-lg cursor-pointer border-blue-300 hover:bg-blue-700 duration-300 hover:text-white ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <FaFileWord className="text-3xl mr-3" />
                <span className="text-2xl mr-2">
                  {selectedFile ? selectedFile.name : "Choose File"}
                </span>
              </label>

              <button
                onClick={handleSubmit}
                disabled={!selectedFile || isLoading}
                className="text-white bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 disabled:pointer-events-none duration-300 font-bold px-4 py-2 rounded-lg min-w-[150px]"
              >
                {isLoading ? "Converting..." : "Convert File"}
              </button>

              {convert && (
                <div className="text-green-500 text-center font-semibold">
                  {convert}
                </div>
              )}
              {downloadError && (
                <div className="text-red-500 text-center font-semibold">
                  {downloadError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;
