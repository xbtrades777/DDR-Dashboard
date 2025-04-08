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
    return;
  }
  
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
    
// Check Color % match
if (selectedPercentage) {
  // Get the value in the data
  const itemColorPercentage = item['color_%'];
  
  // Compare with the selected value
  if (itemColorPercentage !== selectedPercentage) {
    console.log(`Color % mismatch: "${itemColorPercentage}" vs "${selectedPercentage}"`);
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
  } else {
    setProbabilityStats(null);
  }
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
      
      // Calculate average values for numeric fields
      const numericFields = ['rdr_range', 'odr_range', 'profit', 'loss', 'drawdown'];
      const averages = {};
      
      numericFields.forEach(field => {
        const validValues = filteredData
          .map(item => parseFloat(item[field]))
          .filter(val => !isNaN(val));
          
        if (validValues.length > 0) {
          const sum = validValues.reduce((acc, val) => acc + val, 0);
          averages[field] = (sum / validValues.length).toFixed(2);
        } else {
          averages[field] = 'N/A';
        }
      });
      
      // Original win/loss rates
      const winRate = resultPercentages['win'] || 0;
      const lossRate = resultPercentages['loss'] || 0;
      const breakEvenRate = resultPercentages['break_even'] || 0;
      
      // Set the calculated statistics with outcome probabilities
      setProbabilityStats({
        totalCount,
        winRate,
        lossRate,
        breakEvenRate,
        outcomeCounts,
        outcomePercentages,
        averages,
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

      {/* Second Hit Outcome Probability Cards */}
      {probabilityStats && probabilityStats.outcomePercentages && (
        <div className="mt-6">
          <h2 className="font-semibold mb-4 text-gray-800 text-xl">Second Hit Probabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Min Outcome Card */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-purple-800">Min</h3>
                  <p className="text-3xl font-bold text-purple-600">{probabilityStats.outcomePercentages['Min']}%</p>
                </div>
                <div className="h-12 w-12 bg-purple-200 rounded-full flex items-center justify-center">
                  <span className="text-purple-700 text-xl">M</span>
                </div>
              </div>
              <p className="text-xs text-purple-700 mt-2">
                {probabilityStats.outcomeCounts['Min']} occurrences out of {probabilityStats.totalCount} trades
              </p>
            </div>
            
            {/* MinMed Outcome Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-indigo-800">MinMed</h3>
                  <p className="text-3xl font-bold text-indigo-600">{probabilityStats.outcomePercentages['MinMed']}%</p>
                </div>
                <div className="h-12 w-12 bg-indigo-200 rounded-full flex items-center justify-center">
                  <span className="text-indigo-700 text-xl">MM</span>
                </div>
              </div>
              <p className="text-xs text-indigo-700 mt-2">
                {probabilityStats.outcomeCounts['MinMed']} occurrences out of {probabilityStats.totalCount} trades
              </p>
            </div>
            
            {/* MedMax Outcome Card */}
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-cyan-800">MedMax</h3>
                  <p className="text-3xl font-bold text-cyan-600">{probabilityStats.outcomePercentages['MedMax']}%</p>
                </div>
                <div className="h-12 w-12 bg-cyan-200 rounded-full flex items-center justify-center">
                  <span className="text-cyan-700 text-xl">MX</span>
                </div>
              </div>
              <p className="text-xs text-cyan-700 mt-2">
                {probabilityStats.outcomeCounts['MedMax']} occurrences out of {probabilityStats.totalCount} trades
              </p>
            </div>
            
            {/* Max+ Outcome Card */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-amber-800">Max+</h3>
                  <p className="text-3xl font-bold text-amber-600">{probabilityStats.outcomePercentages['Max+']}%</p>
                </div>
                <div className="h-12 w-12 bg-amber-200 rounded-full flex items-center justify-center">
                  <span className="text-amber-700 text-xl">M+</span>
                </div>
              </div>
              <p className="text-xs text-amber-700 mt-2">
                {probabilityStats.outcomeCounts['Max+']} occurrences out of {probabilityStats.totalCount} trades
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Probability Statistics Section */}
      {probabilityStats && (
        <div className="mt-6">
          <h2 className="font-semibold mb-4 text-gray-800 text-xl">Trade Result Statistics</h2>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Win Rate Card */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-green-800">Win Rate</h3>
                  <p className="text-3xl font-bold text-green-600">{probabilityStats.winRate}%</p>
                </div>
                <div className="h-12 w-12 bg-green-200 rounded-full flex items-center justify-center">
                  <span className="text-green-700 text-xl">✓</span>
                </div>
              </div>
              {probabilityStats.resultCounts && (
                <p className="text-xs text-green-700 mt-2">
                  {probabilityStats.resultCounts['win'] || 0} wins out of {probabilityStats.totalCount} trades
                </p>
              )}
            </div>
            
            {/* Loss Rate Card */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-red-800">Loss Rate</h3>
                  <p className="text-3xl font-bold text-red-600">{probabilityStats.lossRate}%</p>
                </div>
                <div className="h-12 w-12 bg-red-200 rounded-full flex items-center justify-center">
                  <span className="text-red-700 text-xl">✗</span>
                </div>
              </div>
              {probabilityStats.resultCounts && (
                <p className="text-xs text-red-700 mt-2">
                  {probabilityStats.resultCounts['loss'] || 0} losses out of {probabilityStats.totalCount} trades
                </p>
              )}
            </div>
            
            {/* Breakeven Rate Card */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-blue-800">Breakeven Rate</h3>
                  <p className="text-3xl font-bold text-blue-600">{probabilityStats.breakEvenRate}%</p>
                </div>
                <div className="h-12 w-12 bg-blue-200 rounded-full flex items-center justify-center">
                  <span className="text-blue-700 text-xl">=</span>
                </div>
              </div>
              {probabilityStats.resultCounts && (
                <p className="text-xs text-blue-700 mt-2">
                  {probabilityStats.resultCounts['break_even'] || 0} breakevens out of {probabilityStats.totalCount} trades
                </p>
              )}
            </div>
          </div>
          
          {/* Averages Table */}
          {probabilityStats.averages && (
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-6">
              <h3 className="font-medium text-gray-700 mb-3">Average Values</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Metric</th>
                      <th className="px-4 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(probabilityStats.averages).map(([key, value]) => (
                      <tr key={key} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-left capitalize">{key.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 text-right font-medium">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Results Distribution */}
          {probabilityStats.resultPercentages && (
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <h3 className="font-medium text-gray-700 mb-3">Results Distribution</h3>
              <div className="space-y-3">
                {Object.entries(probabilityStats.resultPercentages).map(([result, percentage]) => (
                  <div key={result} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize text-gray-600">{result.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          result === 'win' ? 'bg-green-500' : 
                          result === 'loss' ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Visual representation area with basic chart */}
      <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <h2 className="font-semibold mb-6 text-gray-800 text-xl">Visual Representation</h2>
        
        {selectedModel && probabilityStats && probabilityStats.outcomePercentages ? (
          <div className="h-64">
            <div className="h-full flex items-end space-x-8 justify-center">
              {Object.entries(probabilityStats.outcomePercentages).map(([outcome, percentage]) => (
                <div key={outcome} className="flex flex-col items-center justify-end h-full">
                  <div 
                    className={`w-24 ${
                      outcome === 'Min' ? 'bg-purple-500' : 
                      outcome === 'MinMed' ? 'bg-indigo-500' : 
                      outcome === 'MedMax' ? 'bg-cyan-500' : 'bg-amber-500'
                    } rounded-t-lg shadow-inner transition-all duration-500 ease-in-out`}
                    style={{ height: `${percentage}%` }}
                  ></div>
                  <div className="mt-2 text-center">
                    <p className="font-medium">{outcome}</p>
                    <p className="text-xl font-bold">{percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : sheetData.length > 0 ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-gray-500">Select a first hit pattern and time to see probability visualization</p>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <p className="text-gray-500">Connect to your Google Sheet to see visualizations</p>
          </div>
        )}
      </div>
      
      {/* Selected Values Display */}
      {selectedModel && (
        <div className="mt-8 p-4 bg-blue-50 rounded-md">
          <h2 className="font-semibold mb-2 text-gray-700">Selected Values:</h2>
          <p><strong>First Hit Pattern:</strong> {selectedModel || 'None'}</p>
          <p><strong>First Hit Time:</strong> {selectedHighLow || 'None'}</p>
          {showColorSelection && (
            <p><strong>Color:</strong> {selectedColor || 'None'}</p>
          )}
          {showPercentage && (
            <p><strong>Percentage:</strong> {selectedPercentage || 'None'}</p>
          )}
        </div>
      )}

      {/* Google Sheets API Connection UI */}
      <div className="mt-8 p-4 bg-gray-50 rounded-md">
        <h2 className="font-semibold mb-4 text-gray-700">Google Sheets API Connection</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input 
              id="api-key"
              type="text" 
              placeholder="Enter your Google API Key" 
              className="w-full p-2 border border-gray-300 rounded-md"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="spreadsheet-id" className="block text-sm font-medium text-gray-700 mb-1">
              Spreadsheet ID
            </label>
            <input 
              id="spreadsheet-id"
              type="text" 
              placeholder="Enter your Spreadsheet ID" 
              className="w-full p-2 border border-gray-300 rounded-md"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              ID from your link: 1RLktcJRtgG2Hoszy8Z5Ur9OoVZP_ROxfIpAC6zRGE0Q
            </p>
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="sheet-name" className="block text-sm font-medium text-gray-700 mb-1">
            Sheet Name
          </label>
          <input 
            id="sheet-name"
            type="text" 
            placeholder="e.g., DDR Modeling Raw" 
            className="w-full p-2 border border-gray-300 rounded-md"
            value={sheetName}
            onChange={(e) => {
              setSheetName(e.target.value);
              setSheetRange(`${e.target.value}!A1:Z1000`);
            }}
          />
          <p className="text-xs text-gray-500 mt-1">
            File name: DDR Modeling, Sheet name: DDR Modeling Raw
          </p>
        </div>
        <div className="mb-4">
          <label htmlFor="sheet-range" className="block text-sm font-medium text-gray-700 mb-1">
            Sheet Range (optional)
          </label>
          <input 
            id="sheet-range"
            type="text" 
            placeholder="e.g., DDR Modeling Raw!A1:Z1000" 
            className="w-full p-2 border border-gray-300 rounded-md"
            value={sheetRange}
            onChange={(e) => setSheetRange(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <button 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
            onClick={() => fetchGoogleSheetsAPI(apiKey, spreadsheetId, sheetRange)}
            disabled={!apiKey || !spreadsheetId}
          >
            Connect
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Important: Make sure your Google Sheet is shared with the appropriate permissions.
          <br />
          For API access, set the sheet to "Anyone with the link can view" or more permissive.
        </p>
      </div>
    </div>
  );
};

// Need to define these for the browser environment since we're not using imports
const { useState, useEffect } = React;

// Render the React component to the DOM
ReactDOM.render(<DDRDashboard />, document.getElementById('root'));
