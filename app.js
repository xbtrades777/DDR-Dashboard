const DDRDashboard = () => {
  // All available models with correct spacing
  const allModels = [
    'Min - Min',
    'Min - MinMed',
    'Min - MedMax',
    'Min - Max+',
    'MinMed - Min',
    'MinMed - MinMed',
    'MinMed - MedMax',
    'MinMed - Max+',
    'MedMax - Min',
    'MedMax - MinMed',
    'MedMax - MedMax',
    'Max+ - Min',
    'Max+ - MedMax',
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
    'Green 0-50%',
    'Green 50-100%',
    'Red 0-50%',
    'Red 50-100%'
  ];

  // State for selections
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedHighLow, setSelectedHighLow] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedPercentage, setSelectedPercentage] = useState('');
  const [showPercentage, setShowPercentage] = useState(false);
  
  // Simulated dataset count (in a real app, this would be calculated from actual data)
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

  // Effect to determine if percentage options should be shown 
  // and to handle color selection visibility
  const [showColorSelection, setShowColorSelection] = useState(false);
  
  useEffect(() => {
    if (selectedModel.startsWith('Min -')) {
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
  
  // Effect to load Google Sheet data on component mount
  useEffect(() => {
    // If we have API key and spreadsheet ID, try to fetch data
    if (apiKey && spreadsheetId) {
      fetchGoogleSheetsAPI(apiKey, spreadsheetId, sheetRange);
    }
  }, [apiKey, spreadsheetId, sheetRange]);
  
  // Effect to update dataset count and probabilities when selections change
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

  // Function to fetch CSV from published Google Sheet
  const fetchPublishedCSV = async (spreadsheetId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
      console.log('Attempting to fetch CSV from:', csvUrl);
      
      const response = await fetch(csvUrl);
      
      if (!response.ok) {
        throw new Error('CSV fetch responded with status: ' + response.status);
      }
      
      const csvText = await response.text();
      
      if (csvText.trim().length === 0) {
        throw new Error('CSV is empty');
      }
      
      // Parse CSV using PapaParse
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: (header) => {
          // Convert headers to lowercase and replace spaces with underscores for consistency
          return header.toLowerCase().replace(/\s+/g, '_').replace(/%/g, '_percent');
        },
        complete: (results) => {
          console.log('Headers detected:', results.meta.fields);
          console.log('Row count:', results.data.length);
          console.log('Sample data:', results.data.slice(0, 2));
          
          setSheetData(results.data);
          setIsLoading(false);
          updateDatasetCount();
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
          setError('Error parsing CSV: ' + error.message);
          setIsLoading(false);
        }
      });
    } catch (error) {
      console.error('CSV fetch error:', error);
      setError('Error fetching CSV: ' + error.message);
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
    
    // Create criteria object based on selections and mapped column names
    const criteria = {
      model: selectedModel,
    };
    
    // Add outside_min_start criteria if selected
    if (selectedColor) {
      criteria.outside_min_start = selectedColor;
    }
    
    // Add color_ criteria if selected
    if (selectedPercentage) {
      criteria.color_ = selectedPercentage;
    }
    
    console.log('Filtering with criteria:', criteria);
    
    // Filter data based on criteria with improved matching
    const matchingData = sheetData.filter(item => {
      // Check model match
      if (criteria.model && item.model !== criteria.model) {
        return false;
      }
      
      // Check outside_min_start match
      if (criteria.outside_min_start && item.outside_min_start !== criteria.outside_min_start) {
        return false;
      }
      
      // Check color_ match
      if (criteria.color_ && item.color_ !== criteria.color_) {
        return false;
      }
      
    // Special handling for High/Low which maps to first_hit_time
if (selectedHighLow) {
  // Make sure we're using the correct field name - "first_hit_time" from "First Hit Time"
  if (item.first_hit_time !== selectedHighLow) {
    // Log the mismatch for debugging
    console.log(`First hit time mismatch: "${item.first_hit_time}" vs "${selectedHighLow}"`);
    return false;
  }
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
      // Get all unique results from the data
      const resultField = 'result'; // Assuming result field exists in your data
      
      // Count occurrences of each result type
      const resultCounts = {};
      let totalResults = 0;
      
      filteredData.forEach(item => {
        if (item[resultField]) {
          resultCounts[item[resultField]] = (resultCounts[item[resultField]] || 0) + 1;
          totalResults++;
        }
      });
      
      // Calculate percentages for each result
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
      
      // Calculate win rate and other key metrics
      const winRate = resultPercentages['win'] || 0;
      const lossRate = resultPercentages['loss'] || 0;
      const breakEvenRate = resultPercentages['break_even'] || 0;
      
      // Set the calculated statistics
      setProbabilityStats({
        totalCount,
        winRate,
        lossRate,
        breakEvenRate,
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
          <h2 className="font-semibold mb-2 text-gray-700">START</h2>
          <select 
            value={selectedModel}
            onChange={handleModelChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">Select a model</option>
            {allModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
        
        {/* High/Low Selection */}
        {selectedModel && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h2 className="font-semibold mb-2 text-gray-700">High/Low</h2>
            <select 
              value={selectedHighLow}
              onChange={handleHighLowChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Select High/Low</option>
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

      {/* Probability Statistics Section */}
      {probabilityStats && (
        <div className="mt-6">
          <h2 className="font-semibold mb-4 text-gray-800 text-xl">Probability Statistics</h2>
          
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
        
        {selectedModel && probabilityStats ? (
          <div className="h-64">
            {/* Simple visualization of result percentages */}
            <div className="h-full flex items-end space-x-8 justify-center">
              {probabilityStats.resultPercentages && Object.entries(probabilityStats.resultPercentages).map(([result, percentage]) => (
                <div key={result} className="flex flex-col items-center justify-end h-full">
                  <div 
                    className={`w-24 ${
                      result === 'win' ? 'bg-green-500' : 
                      result === 'loss' ? 'bg-red-500' : 'bg-blue-500'
                    } rounded-t-lg shadow-inner transition-all duration-500 ease-in-out`}
                    style={{ height: `${percentage}%` }}
                  ></div>
                  <div className="mt-2 text-center">
                    <p className="font-medium capitalize">{result.replace(/_/g, ' ')}</p>
                    <p className="text-xl font-bold">{percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : sheetData.length > 0 ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-gray-500">Select a model to see its visualization</p>
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
          <p><strong>Model:</strong> {selectedModel || 'None'}</p>
          <p><strong>High/Low:</strong> {selectedHighLow || 'None'}</p>
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
        <p className="mt-2 text-sm text-gray-600">
          <strong>Important:</strong> Make sure your Google Sheet is shared with the appropriate permissions.
          <br />
          For API access, set the sheet to "Anyone with the link can view" or more permissive.
        </p>
        
        {/* Alternative connection method */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="font-medium text-gray-700 mb-2">Alternative: Direct CSV Import</h3>
          <p className="text-sm text-gray-600 mb-2">
            If API access isn't working, try using the published CSV URL instead.
          </p>
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="Enter Spreadsheet ID" 
              className="flex-grow p-2 border border-gray-300 rounded-md"
            />
            <button 
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md"
              onClick={() => fetchPublishedCSV(spreadsheetId)}
            >
              Import CSV
            </button>
          </div>
          <p className="text-xs text-gray-500
                <p className="text-xs text-gray-500 mt-2">
            Important: Make sure your Google Sheet is published to the web. Go to File → Share → Publish to web, 
            and select "Entire Document" and "CSV".
          </p>
        </div>
      </div>
    </div>
  );
};

// Need to define these for the browser environment since we're not using imports
const { useState, useEffect } = React;

// Render the React component to the DOM
ReactDOM.render(<DDRDashboard />, document.getElementById('root'));
