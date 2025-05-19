// Load Chart.js library before the component
const loadChartJS = () => {
  if (typeof Chart === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js';
    script.async = true;
    script.onload = () => {
      console.log('Chart.js loaded successfully');
    };
    document.head.appendChild(script);
  }
};

// Call this function immediately
loadChartJS();

const DDRDashboard = () => {
  // All available first parts of models only
  const allModels = [
    'Min',
    'MinMed',
    'MedMax',
    'Max+',
    ''  // Blank option
  ];

  // High/Low options
  const highLowOptions = [
    'Low ODR',
    'High ODR',
    'Low Trans',
    'High Trans',
    'Low RDR',
    'High RDR'
  ];

  // Color options
  const colorOptions = [
    'MinMed Green',
    'MedMax Green',
    'Max+ Green',
    'MinMed Red',
    'MedMax Red',
    'Max+ Red'
  ];

  // Percentage options for Min
  const percentageOptions = [
    'Green 0 - 50%',
    'Green 50 - 100%',
    'Red 0 - 50%',
    'Red 50 - 100%'
  ];

  // State for selections
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedHighLow, setSelectedHighLow] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedPercentage, setSelectedPercentage] = useState('');
  const [showPercentage, setShowPercentage] = useState(false);
  
  // Dataset count
  const [datasetCount, setDatasetCount] = useState(0);

  // State for Google Sheet data
  const [isLoading, setIsLoading] = useState(false);
  const [sheetData, setSheetData] = useState([]);
  const [error, setError] = useState(null);
  const [probabilityStats, setProbabilityStats] = useState(null);

  // State for time distribution charts
  const [firstHitTimeDistribution, setFirstHitTimeDistribution] = useState(null);
  const [secondHitTimeDistribution, setSecondHitTimeDistribution] = useState(null);
  const [chartsInitialized, setChartsInitialized] = useState(false);

  // State for API connection parameters
  const [apiKey, setApiKey] = useState('AIzaSyBB5_LHGAX_tirA23TzDEesMJhm_Srrs9s');
  const [spreadsheetId, setSpreadsheetId] = useState('1RLktcJRtgG2Hoszy8Z5Ur9OoVZP_ROxfIpAC6zRGE0Q');
  const [sheetName, setSheetName] = useState('DDR Modeling Raw');
  const [sheetRange, setSheetRange] = useState('DDR Modeling Raw!A1:Z1000');

  // Control when to show color selection
  const [showColorSelection, setShowColorSelection] = useState(false);
  
  useEffect(() => {
    if (selectedModel === 'Min') {
      setShowPercentage(true);
      setShowColorSelection(false);
      setSelectedColor('');
    } else if (selectedModel) {
      setShowPercentage(false);
      setShowColorSelection(true);
      setSelectedPercentage('');
    } else {
      setShowPercentage(false);
      setShowColorSelection(false);
      setSelectedPercentage('');
      setSelectedColor('');
    }
  }, [selectedModel]);
  
  // Load data on mount if credentials available
  useEffect(() => {
    if (apiKey && spreadsheetId) {
      fetchGoogleSheetsAPI(apiKey, spreadsheetId, sheetRange);
    }
  }, [apiKey, spreadsheetId, sheetRange]);
  
  // Update dataset count when selections change
  useEffect(() => {
    updateDatasetCount();
  }, [selectedModel, selectedHighLow, selectedColor, selectedPercentage, sheetData]);

  // Effect to render time distribution charts when data changes
  useEffect(() => {
    if (firstHitTimeDistribution && secondHitTimeDistribution) {
      // Wait for Chart.js to load
      const tryRenderCharts = () => {
        if (typeof Chart === 'undefined') {
          // If Chart.js isn't loaded yet, retry after a short delay
          setTimeout(tryRenderCharts, 200);
          return;
        }
        
        renderTimeDistributionChart(
          'firstHitTimeChart', 
          firstHitTimeDistribution, 
          'First Hit Time Distribution', 
          'rgba(54, 162, 235, 0.7)'
        );
        
        renderTimeDistributionChart(
          'secondHitTimeChart', 
          secondHitTimeDistribution, 
          'Second Hit Time Distribution', 
          'rgba(255, 99, 132, 0.7)'
        );
        
        setChartsInitialized(true);
      };
      
      tryRenderCharts();
    }
  }, [firstHitTimeDistribution, secondHitTimeDistribution]);

  // Function to parse time strings to get hour value
  const parseTimeToTimeBlock = (timeStr) => {
    if (!timeStr) return null;
    
    // Extract time part from strings like "Low ODR 3:30"
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!timeMatch) return null;
    
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    
    // Create time block in 15-minute intervals
    const minuteBlock = Math.floor(minute / 15) * 15;
    const formattedHour = hour.toString().padStart(2, '0');
    const formattedMinute = minuteBlock.toString().padStart(2, '0');
    
    return `${formattedHour}:${formattedMinute}`;
  };

  // Function to fetch data from Google Sheets API
  const fetchGoogleSheetsAPI = async (apiKey, spreadsheetId, range = 'DDR Modeling Raw!A1:Z1000') => {
    setIsLoading(true);
    setError(null);
    
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
      console.log('Attempting to fetch from:', url);
      
      const response = await fetch(url);
      const responseText = await response.text();
      
      try {
        // Try to parse as JSON
        const data = JSON.parse(responseText);
        
        if (!response.ok) {
          console.error('API Error Details:', data);
          throw new Error('API error: ' + (data.error && data.error.message ? data.error.message : 'Unknown error'));
        }
        
        if (!data.values || data.values.length === 0) {
          setError('No data found in the specified range');
          setIsLoading(false);
          return;
        }
        
        // Extract headers and data
        const headers = data.values[0];
        const rows = data.values.slice(1);
        
        console.log('Headers detected:', headers);
        console.log('Row count:', rows.length);
        
        // Convert to array of objects with header keys
        const processedData = rows.map(row => {
          const item = {};
          headers.forEach((header, index) => {
            // Convert header to lowercase and replace spaces with underscores for consistency
            const key = header.toLowerCase().replace(/\s+/g, '_');
            // Make sure to handle case where row might not have value for this column
            item[key] = row[index] || null;
          });
          return item;
        });
        
        console.log('Sample processed data:', processedData.slice(0, 2));
        
        setSheetData(processedData);
        setIsLoading(false);
        updateDatasetCount();
      } catch (jsonError) {
        // If response isn't valid JSON, show the raw response
        console.error('Response is not valid JSON:', responseText);
        throw new Error('Invalid API response: ' + responseText.substring(0, 100) + '...');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setError('Error fetching data: ' + error.message);
      setIsLoading(false);
    }
  };

  // Function to update dataset count based on selected criteria
  const updateDatasetCount = () => {
    if (!selectedModel || sheetData.length === 0) {
      setDatasetCount(0);
      setProbabilityStats(null);
      setFirstHitTimeDistribution(null);
      setSecondHitTimeDistribution(null);
      return;
    }
    
    // Create criteria object - now we look for models that START with the selected value
    console.log('Filtering with first hit:', selectedModel);
    console.log('Selected percentage:', selectedPercentage);
    
    // Log a sample item to check the field names
    if (sheetData.length > 0) {
      console.log('Sample item:', sheetData[0]);
    }
    
    // Filter data to find all records where the model starts with the selected value
    const matchingData = sheetData.filter(item => {
      // Check if model exists and starts with the selected model
      if (selectedModel && (!item.model || !item.model.startsWith(selectedModel + ' -'))) {
        return false;
      }
      
      // Check outside_min_start match
      if (selectedColor && item.outside_min_start !== selectedColor) {
        return false;
      }
      
      // Check Color % match - using bracket notation for the '%' character
      if (selectedPercentage) {
        // If selected percentage doesn't match, return false
        if (item['color_%'] !== selectedPercentage) {
          console.log(`Color % mismatch: "${item['color_%']}" vs "${selectedPercentage}"`);
          return false;
        }
      }
      
      // Check First Hit Time match
      if (selectedHighLow && item.first_hit_time !== selectedHighLow) {
        return false;
      }
      
      return true;
    });
    
    console.log('Found matching datasets:', matchingData.length);
    
    // Update count
    setDatasetCount(matchingData.length);
    
    // Calculate probabilities if we have matching data
    if (matchingData.length > 0) {
      calculateProbabilities(matchingData);
      calculateTimeDistributions(matchingData);
    } else {
      setProbabilityStats(null);
      setFirstHitTimeDistribution(null);
      setSecondHitTimeDistribution(null);
    }
  };

  // Calculate time distributions for first and second hit times
  const calculateTimeDistributions = (filteredData) => {
    // Since we don't have detailed time data, let's use the session information
    const timeCategories = ['ODR', 'Trans', 'RDR'];
    const firstHitCounts = { 'ODR': 0, 'Trans': 0, 'RDR': 0 };
    const secondHitCounts = { 'ODR': 0, 'Trans': 0, 'RDR': 0 };
    
    filteredData.forEach(item => {
      // Process first hit session
      if (item.first_hit_time) {
        const session = item.first_hit_time.includes('ODR') ? 'ODR' : 
                       item.first_hit_time.includes('Trans') ? 'Trans' : 
                       item.first_hit_time.includes('RDR') ? 'RDR' : null;
        
        if (session) firstHitCounts[session]++;
      }
      
      // Process second hit session
      if (item.second_hit_time) {
        const session = item.second_hit_time.includes('ODR') ? 'ODR' : 
                       item.second_hit_time.includes('Trans') ? 'Trans' : 
                       item.second_hit_time.includes('RDR') ? 'RDR' : null;
        
        if (session) secondHitCounts[session]++;
      }
    });
    
    // Set the simplified distributions
    setFirstHitTimeDistribution({
      labels: timeCategories,
      data: timeCategories.map(cat => firstHitCounts[cat])
    });
    
    setSecondHitTimeDistribution({
      labels: timeCategories,
      data: timeCategories.map(cat => secondHitCounts[cat])
    });
  };

  // Calculate probability statistics
  const calculateProbabilities = (filteredData) => {
    const totalCount = filteredData.length;
    
    try {
      // Calculate second hit outcome probabilities
      const outcomeTypes = ['Min', 'MinMed', 'MedMax', 'Max+'];
      const outcomeCounts = {
        'Min': 0,
        'MinMed': 0,
        'MedMax': 0,
        'Max+': 0
      };
      
      // Count occurrences by parsing the Model column
      filteredData.forEach(item => {
        if (item.model) {
          // Split the model value by the hyphen to get first and second hit
          const parts = item.model.split(' - ');
          
          if (parts.length === 2) {
            const secondHit = parts[1];
            
            // Count based on the second hit value
            if (outcomeTypes.includes(secondHit)) {
              outcomeCounts[secondHit]++;
            }
          }
        }
      });
      
      // Calculate percentages
      const outcomePercentages = {};
      outcomeTypes.forEach(type => {
        outcomePercentages[type] = totalCount > 0 
          ? ((outcomeCounts[type] / totalCount) * 100).toFixed(1) 
          : 0;
      });
      
      // Calculate timing location probabilities for second hit
      const timingLocations = ['ODR', 'Trans', 'RDR'];
      const locationCounts = {
        'ODR': 0,
        'Trans': 0,
        'RDR': 0
      };
      
      // Count occurrences by analyzing the First to Second field
      filteredData.forEach(item => {
        if (item.first_to_second) {
          const value = item.first_to_second;
          
          // Check which location it contains for the second hit
          // The format is "X XXX - Y YYY" where YYY is the second hit location
          const parts = value.split(' - ');
          if (parts.length === 2) {
            const secondHitInfo = parts[1]; // e.g., "High RDR" or "Low ODR"
            
            // Determine which location it is
            if (secondHitInfo.includes('ODR')) {
              locationCounts['ODR']++;
            } else if (secondHitInfo.includes('Trans')) {
              locationCounts['Trans']++;
            } else if (secondHitInfo.includes('RDR')) {
              locationCounts['RDR']++;
            }
          }
        }
      });
      
      // Calculate percentages
      const locationPercentages = {};
      timingLocations.forEach(location => {
        locationPercentages[location] = totalCount > 0 
          ? ((locationCounts[location] / totalCount) * 100).toFixed(1) 
          : 0;
      });
      
      // Original result type calculations (win/loss/breakeven)
      const resultField = 'result';
      const resultCounts = {};
      let totalResults = 0;
      
      filteredData.forEach(item => {
        if (item[resultField]) {
          resultCounts[item[resultField]] = (resultCounts[item[resultField]] || 0) + 1;
          totalResults++;
        }
      });
      
      const resultPercentages = {};
      Object.keys(resultCounts).forEach(result => {
        resultPercentages[result] = totalResults > 0 
          ? ((resultCounts[result] / totalResults) * 100).toFixed(1) 
          : 0;
      });
      
      // Set the calculated statistics with outcome and location probabilities
      setProbabilityStats({
        totalCount,
        outcomeCounts,
        outcomePercentages,
        locationCounts,
        locationPercentages,
        resultCounts,
        resultPercentages
      });
      
    } catch (error) {
      console.error('Error calculating probabilities:', error);
      setProbabilityStats({
        totalCount,
        error: error.message
      });
    }
  };

  // Function to render time distribution chart using Chart.js
  const renderTimeDistributionChart = (canvasId, distributionData, title, color) => {
    if (!distributionData || !document.getElementById(canvasId)) return;
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      console.error('Chart.js is not loaded yet. Cannot render chart: ' + canvasId);
      return;
    }

    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Destroy previous chart if it exists
    if (window[canvasId + 'Chart']) {
      window[canvasId + 'Chart'].destroy();
    }
    
    window[canvasId + 'Chart'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: distributionData.labels,
        datasets: [{
          label: title,
          data: distributionData.data,
          backgroundColor: color,
          borderColor: color.replace('0.7', '1.0'),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 16
            }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Occurrences'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Session'
            }
          }
        }
      }
    });
  };

  // Handle model selection change
  const handleModelChange = (event) => {
    setSelectedModel(event.target.value);
    // Reset other selections when model changes
    setSelectedHighLow('');
    setSelectedColor('');
    setSelectedPercentage('');
    updateDatasetCount();
  };
  
  // Handle high/low selection change
  const handleHighLowChange = (event) => {
    setSelectedHighLow(event.target.value);
    updateDatasetCount();
  };
  
  // Handle color selection change
  const handleColorChange = (event) => {
    setSelectedColor(event.target.value);
    updateDatasetCount();
  };
  
  // Handle percentage selection change
  const handlePercentageChange = (event) => {
    setSelectedPercentage(event.target.value);
    updateDatasetCount();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">DDR Probability Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* START Model Selection */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h2 className="font-semibold mb-2 text-gray-700">First Hit Pattern</h2>
          <select 
            value={selectedModel}
            onChange={handleModelChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">Select pattern</option>
            {allModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
        
        {/* High/Low Selection */}
        {selectedModel && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h2 className="font-semibold mb-2 text-gray-700">First Hit Time</h2>
            <select 
              value={selectedHighLow}
              onChange={handleHighLowChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Select time</option>
              {highLowOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        )}
        
        {/* Color Selection - Only shown when the first part is NOT Min */}
        {showColorSelection && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h2 className="font-semibold mb-2 text-gray-700">Color</h2>
            <select 
              value={selectedColor}
              onChange={handleColorChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Select color</option>
              {colorOptions.map((color) => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>
        )}
        
        {/* Percentage Selection - Only shown for Min-* models */}
        {showPercentage && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h2 className="font-semibold mb-2 text-gray-700">% Color</h2>
            <select 
              value={selectedPercentage}
              onChange={handlePercentageChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Select percentage</option>
              {percentageOptions.map((percentage) => (
                <option key={percentage} value={percentage}>{percentage}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      {/* Loading and Error States */}
      {isLoading && (
        <div className="mt-6 p-4 bg-yellow-50 rounded-md text-center">
          <p className="text-yellow-600">Loading data from Google Sheet...</p>
        </div>
      )}
      
      {error && (
        <div className="mt-6 p-4 bg-red-50 rounded-md text-center">
          <p className="text-red-600">Error: {error}</p>
        </div>
      )}
      
      {/* Dataset Counter */}
      <div className="mt-6 bg-blue-100 p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Matching Datasets</h2>
          <div className="flex items-center bg-white px-4 py-2 rounded-full shadow">
            <span className="text-2xl font-bold text-blue-600 mr-2">{datasetCount}</span>
            <span className="text-gray-500 text-sm">records</span>
          </div>
        </div>
      </div>

      {/* Hit Time Distribution Charts */}
      <div className="mt-6">
        <h2 className="font-semibold mb-4 text-gray-800 text-xl">Time Distribution Analysis</h2>
        
        {/* First Hit Time Distribution */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-6">
          <h3 className="font-medium text-gray-700 mb-3">First Hit Time Distribution</h3>
          <div style={{ height: "300px" }}>
            <canvas id="firstHitTimeChart"></canvas>
          </div>
        </div>
        
        {/* Second Hit Time Distribution */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-6">
          <h3 className="font-medium text-gray-700 mb-3">Second Hit Time Distribution</h3>
          <div style={{ height: "300px" }}>
            <canvas id="secondHitTimeChart"></canvas>
          </div>
        </div>
      </div>

      {/* Second Hit Outcome Probability Cards */}
      {probabilityStats && probabilityStats.outcomePercentages && (
        <div className="mt-6">
          <h2 className="font-semibold mb-4 text-gray-800 text-xl">Second Hit Probabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Min Outcome Card */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
