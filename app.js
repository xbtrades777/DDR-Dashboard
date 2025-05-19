const DDRDashboard = function() {
  // All available first parts of models only
  const [selectedModel, setSelectedModel] = React.useState('');
  const [selectedHighLow, setSelectedHighLow] = React.useState('');
  const [selectedColor, setSelectedColor] = React.useState('');
  const [selectedPercentage, setSelectedPercentage] = React.useState('');
  const [showPercentage, setShowPercentage] = React.useState(false);
  const [datasetCount, setDatasetCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [sheetData, setSheetData] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [probabilityStats, setProbabilityStats] = React.useState(null);
  const [apiKey, setApiKey] = React.useState('AIzaSyBB5_LHGAX_tirA23TzDEesMJhm_Srrs9s');
  const [spreadsheetId, setSpreadsheetId] = React.useState('1RLktcJRtgG2Hoszy8Z5Ur9OoVZP_ROxfIpAC6zRGE0Q');
  const [sheetName, setSheetName] = React.useState('DDR Modeling Raw');
  const [sheetRange, setSheetRange] = React.useState('DDR Modeling Raw!A1:Z1000');
  const [showColorSelection, setShowColorSelection] = React.useState(false);

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

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (apiKey && spreadsheetId) {
      fetchGoogleSheetsAPI(apiKey, spreadsheetId, sheetRange);
    }
  }, [apiKey, spreadsheetId, sheetRange]);

  React.useEffect(() => {
    updateDatasetCount();
    if (sheetData.length > 0) {
      const firstHitStats = calculateTimingStats(sheetData, 'first_hit_time');
      const secondHitStats = calculateTimingStats(sheetData, 'second_hit_time');
      setProbabilityStats(prev => ({
        ...prev,
        firstHitStats,
        secondHitStats
      }));
    }
  }, [selectedModel, selectedHighLow, selectedColor, selectedPercentage, sheetData]);

  const fetchGoogleSheetsAPI = async (apiKey, spreadsheetId, range) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
      console.log('Attempting to fetch from:', url);
      
      const response = await fetch(url);
      const responseText = await response.text();
      
      try {
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
        
        const headers = data.values[0];
        const rows = data.values.slice(1);
        
        console.log('Headers detected:', headers);
        console.log('Row count:', rows.length);
        
        const processedData = rows.map(row => {
          const item = {};
          headers.forEach((header, index) => {
            const key = header.toLowerCase().replace(/\s+/g, '_');
            item[key] = row[index] || null;
          });
          return item;
        });
        
        console.log('Sample processed data:', processedData.slice(0, 2));
        
        setSheetData(processedData);
        setIsLoading(false);
        updateDatasetCount();
      } catch (jsonError) {
        console.error('Response is not valid JSON:', responseText);
        throw new Error('Invalid API response: ' + responseText.substring(0, 100) + '...');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setError('Error fetching data: ' + error.message);
      setIsLoading(false);
    }
  };

  const updateDatasetCount = () => {
    if (!selectedModel || sheetData.length === 0) {
      setDatasetCount(0);
      setProbabilityStats(null);
      return;
    }
    
    console.log('Filtering with first hit:', selectedModel);
    console.log('Selected percentage:', selectedPercentage);
    
    if (sheetData.length > 0) {
      console.log('Sample item:', sheetData[0]);
    }
    
    const matchingData = sheetData.filter(item => {
      const modelMatch = !selectedModel || (item.model && item.model.indexOf(selectedModel + ' -') === 0);
      const colorMatch = !selectedColor || item.outside_min_start === selectedColor;
      const percentageMatch = !selectedPercentage || (item['color_%'] === selectedPercentage);
      const highLowMatch = !selectedHighLow || item.first_hit_time === selectedHighLow;
      
      return modelMatch && colorMatch && percentageMatch && highLowMatch;
    });
    
    console.log('Found matching datasets:', matchingData.length);
    
    setDatasetCount(matchingData.length);
    
    if (matchingData.length > 0) {
      calculateProbabilities(matchingData);
    } else {
      setProbabilityStats(null);
    }
  };

  const calculateProbabilities = (filteredData) => {
    const totalCount = filteredData.length;
    
    try {
      const outcomeTypes = ['Min', 'MinMed', 'MedMax', 'Max+'];
      const outcomeCounts = { 'Min': 0, 'MinMed': 0, 'MedMax': 0, 'Max+': 0 };
      
      filteredData.forEach(item => {
        if (item.model) {
          const parts = item.model.split(' - ');
          if (parts.length === 2) {
            const secondHit = parts[1];
            if (outcomeTypes.indexOf(secondHit) !== -1) {
              outcomeCounts[secondHit]++;
            }
          }
        }
      });
      
      const outcomePercentages = {};
      outcomeTypes.forEach(type => {
        outcomePercentages[type] = totalCount > 0 
          ? ((outcomeCounts[type] / totalCount) * 100).toFixed(1) 
          : 0;
      });
      
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
      for (const result in resultCounts) {
        if (resultCounts.hasOwnProperty(result)) {
          resultPercentages[result] = totalResults > 0 
            ? ((resultCounts[result] / totalResults) * 100).toFixed(1) 
            : 0;
        }
      }
      
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
      
      const winRate = resultPercentages['win'] || 0;
      const lossRate = resultPercentages['loss'] || 0;
      const breakEvenRate = resultPercentages['break_even'] || 0;
      
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

  const calculateTimingStats = (data, timeField) => {
    const times = data
      .map(item => {
        const time = item[timeField];
        return time ? new Date('1970-01-01T' + time).getTime() : null;
      })
      .filter(time => time !== null)
      .sort((a, b) => a - b);

    if (times.length === 0) return { median: null, percentile70: null, counts: {} };

    const mid = Math.floor(times.length / 2);
    const median = times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2;
    const percentile70Index = Math.floor(times.length * 0.7);
    const percentile70 = times[percentile70Index];

    const counts = {};
    times.forEach(time => {
      const hour = new Date(time).toTimeString().slice(0, 5); // HH:MM format
      counts[hour] = (counts[hour] || 0) + 1;
    });

    return {
      median: new Date(median).toTimeString().slice(0, 5),
      percentile70: new Date(percentile70).toTimeString().slice(0, 5),
      counts
    };
  };

  const handleModelChange = (event) => {
    setSelectedModel(event.target.value);
    setSelectedHighLow('');
    setSelectedColor('');
    setSelectedPercentage('');
    updateDatasetCount();
  };
  
  const handleHighLowChange = (event) => {
    setSelectedHighLow(event.target.value);
    updateDatasetCount();
  };
  
  const handleColorChange = (event) => {
    setSelectedColor(event.target.value);
    updateDatasetCount();
  };
  
  const handlePercentageChange = (event) => {
    setSelectedPercentage(event.target.value);
    updateDatasetCount();
  };

  return React.createElement(
    'div',
    { className: 'p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-lg' },
    React.createElement('h1', { className: 'text-2xl font-bold mb-6 text-gray-800' }, 'DDR Probability Dashboard'),
    
    React.createElement(
      'div',
      { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6' },
      React.createElement(
        'div',
        { className: 'bg-gray-50 p-4 rounded-md' },
        React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'First Hit Pattern'),
        React.createElement(
          'select',
          {
            value: selectedModel,
            onChange: handleModelChange,
            className: 'w-full p-2 border border-gray-300 rounded-md'
          },
          React.createElement('option', { value: '' }, 'Select pattern'),
          allModels.map(model => React.createElement('option', { key: model, value: model }, model))
        )
      ),
      
      selectedModel && React.createElement(
        'div',
        { className: 'bg-gray-50 p-4 rounded-md' },
        React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'First Hit Time'),
        React.createElement(
          'select',
          {
            value: selectedHighLow,
            onChange: handleHighLowChange,
            className: 'w-full p-2 border border-gray-300 rounded-md'
          },
          React.createElement('option', { value: '' }, 'Select time'),
          highLowOptions.map(option => React.createElement('option', { key: option, value: option }, option))
        )
      ),
      
      showColorSelection && React.createElement(
        'div',
        { className: 'bg-gray-50 p-4 rounded-md' },
        React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'Color'),
        React.createElement(
          'select',
          {
            value: selectedColor,
            onChange: handleColorChange,
            className: 'w-full p-2 border border-gray-300 rounded-md'
          },
          React.createElement('option', { value: '' }, 'Select color'),
          colorOptions.map(color => React.createElement('option', { key: color, value: color }, color))
        )
      ),
      
      showPercentage && React.createElement(
        'div',
        { className: 'bg-gray-50 p-4 rounded-md' },
        React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, '% Color'),
        React.createElement(
          'select',
          {
            value: selectedPercentage,
            onChange: handlePercentageChange,
            className: 'w-full p-2 border border-gray-300 rounded-md'
          },
          React.createElement('option', { value: '' }, 'Select percentage'),
          percentageOptions.map(percentage => React.createElement('option', { key: percentage, value: percentage }, percentage))
        )
      )
    ),
    
    isLoading && React.createElement(
      'div',
      { className: 'mt-6 p-4 bg-yellow-50 rounded-md text-center' },
      React.createElement('p', { className: 'text-yellow-600' }, 'Loading data from Google Sheet...')
    ),
    
    error && React.createElement(
      'div',
      { className: 'mt-6 p-4 bg-red-50 rounded-md text-center' },
      React.createElement('p', { className: 'text-red-600' }, 'Error: ' + error)
    ),
    
    React.createElement(
      'div',
      { className: 'mt-6 bg-blue-100 p-4 rounded-lg shadow-sm' },
      React.createElement(
        'div',
        { className: 'flex items-center justify-between' },
        React.createElement('h2', { className: 'font-semibold text-gray-800' }, 'Matching Datasets'),
        React.createElement(
          'div',
          { className: 'flex items-center bg-white px-4 py-2 rounded-full shadow' },
          React.createElement('span', { className: 'text-2xl font-bold text-blue-600 mr-2' }, datasetCount),
          React.createElement('span', { className: 'text-gray-500 text-sm' }, 'records')
        )
      )
    ),

    probabilityStats && probabilityStats.outcomePercentages && React.createElement(
      'div',
      { className: 'mt-6' },
      React.createElement('h2', { className: 'font-semibold mb-4 text-gray-800 text-xl' }, 'Second Hit Probabilities'),
      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-4 gap-4 mb-6' },
        React.createElement(
          'div',
          { className: 'bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg shadow' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between' },
            React.createElement(
              'div',
              null,
              React.createElement('h3', { className: 'text-sm font-medium text-purple-800' }, 'Min'),
              React.createElement('p', { className: 'text-3xl font-bold text-purple-600' }, probabilityStats.outcomePercentages['Min'] + '%')
            ),
            React.createElement(
              'div',
              { className: 'h-12 w-12 bg-purple-200 rounded-full flex items-center justify-center' },
              React.createElement('span', { className: 'text-purple-700 text-xl' }, 'M')
            )
          ),
          React.createElement('p', { className: 'text-xs text-purple-700 mt-2' }, probabilityStats.outcomeCounts['Min'] + ' occurrences out of ' + probabilityStats.totalCount + ' trades')
        ),
        React.createElement(
          'div',
          { className: 'bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg shadow' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between' },
            React.createElement(
              'div',
              null,
              React.createElement('h3', { className: 'text-sm font-medium text-indigo-800' }, 'MinMed'),
              React.createElement('p', { className: 'text-3xl font-bold text-indigo-600' }, probabilityStats.outcomePercentages['MinMed'] + '%')
            ),
            React.createElement(
              'div',
              { className: 'h-12 w-12 bg-indigo-200 rounded-full flex items-center justify-center' },
              React.createElement('span', { className: 'text-indigo-700 text-xl' }, 'MM')
            )
          ),
          React.createElement('p', { className: 'text-xs text-indigo-700 mt-2' }, probabilityStats.outcomeCounts['MinMed'] + ' occurrences out of ' + probabilityStats.totalCount + ' trades')
        ),
        React.createElement(
          'div',
          { className: 'bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-lg shadow' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between' },
            React.createElement(
              'div',
              null,
              React.createElement('h3', { className: 'text-sm font-medium text-cyan-800' }, 'MedMax'),
              React.createElement('p', { className: 'text-3xl font-bold text-cyan-600' }, probabilityStats.outcomePercentages['MedMax'] + '%')
            ),
            React.createElement(
              'div',
              { className: 'h-12 w-12 bg-cyan-200 rounded-full flex items-center justify-center' },
              React.createElement('span', { className: 'text-cyan-700 text-xl' }, 'MX')
            )
          ),
          React.createElement('p', { className: 'text-xs text-cyan-700 mt-2' }, probabilityStats.outcomeCounts['MedMax'] + ' occurrences out of ' + probabilityStats.totalCount + ' trades')
        ),
        React.createElement(
          'div',
          { className: 'bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg shadow' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between' },
            React.createElement(
              'div',
              null,
              React.createElement('h3', { className: 'text-sm font-medium text-amber-800' }, 'Max+'),
              React.createElement('p', { className: 'text-3xl font-bold text-amber-600' }, probabilityStats.outcomePercentages['Max+'] + '%')
            ),
            React.createElement(
              'div',
              { className: 'h-12 w-12 bg-amber-200 rounded-full flex items-center justify-center' },
              React.createElement('span', { className: 'text-amber-700 text-xl' }, 'M+')
            )
          ),
          React.createElement('p', { className: 'text-xs text-amber-700 mt-2' }, probabilityStats.outcomeCounts['Max+'] + ' occurrences out of ' + probabilityStats.totalCount + ' trades')
        )
      )
    ),
    
    probabilityStats && probabilityStats.resultPercentages && React.createElement(
      'div',
      { className: 'mt-6' },
      React.createElement(
        'div',
        { className: 'bg-white p-4 rounded-lg shadow border border-gray-200' },
        React.createElement('h3', { className: 'font-medium text-gray-700 mb-3' }, 'Results Distribution'),
        React.createElement(
          'div',
          { className: 'space-y-3' },
          Object.keys(probabilityStats.resultPercentages).map(result => (
            React.createElement(
              'div',
              { key: result, className: 'space-y-1' },
              React.createElement(
                'div',
                { className: 'flex justify-between text-sm' },
                React.createElement('span', { className: 'capitalize text-gray-600' }, result.replace(/_/g, ' ')),
                React.createElement('span', { className: 'font-medium' }, probabilityStats.resultPercentages[result] + '%')
              ),
              React.createElement(
                'div',
                { className: 'w-full bg-gray-200 rounded-full h-2.5' },
                React.createElement('div', {
                  className: 'h-2.5 rounded-full ' + (
                    result === 'win' ? 'bg-green-500' : 
                    result === 'loss' ? 'bg-red-500' : 'bg-blue-500'
                  ),
                  style: { width: probabilityStats.resultPercentages[result] + '%' }
                })
              )
            )
          ))
        )
      )
    ),
    
    React.createElement(
      'div',
      { className: 'mt-8 p-6 bg-white rounded-lg border border-gray-200 shadow-sm' },
      React.createElement('h2', { className: 'font-semibold mb-6 text-gray-800 text-xl' }, 'Visual Representation'),
      selectedModel && probabilityStats && probabilityStats.outcomePercentages ? (
        React.createElement(
          'div',
          { className: 'h-64' },
          React.createElement(
            'div',
            { className: 'h-full flex items-end space-x-8 justify-center' },
            Object.keys(probabilityStats.outcomePercentages).map(outcome => (
              React.createElement(
                'div',
                { key: outcome, className: 'flex flex-col items-center justify-end h-full' },
                React.createElement('div', {
                  className: 'w-24 ' + (
                    outcome === 'Min' ? 'bg-purple-500' : 
                    outcome === 'MinMed' ? 'bg-indigo-500' : 
                    outcome === 'MedMax' ? 'bg-cyan-500' : 'bg-amber-500'
                  ) + ' rounded-t-lg shadow-inner transition-all duration-500 ease-in-out',
                  style: { height: probabilityStats.outcomePercentages[outcome] + '%' }
                }),
                React.createElement(
                  'div',
                  { className: 'mt-2 text-center' },
                  React.createElement('p', { className: 'font-medium' }, outcome),
                  React.createElement('p', { className: 'text-xl font-bold' }, probabilityStats.outcomePercentages[outcome] + '%')
                )
              )
            ))
          )
        )
      ) : sheetData.length > 0 ? (
        React.createElement(
          'div',
          { className: 'h-64 flex items-center justify-center' },
          React.createElement('p', { className: 'text-gray-500' }, 'Select a first hit pattern and time to see probability visualization')
        )
      ) : (
        React.createElement(
          'div',
          { className: 'h-64 flex items-center justify-center' },
          React.createElement('p', { className: 'text-gray-500' }, 'Connect to your Google Sheet to see visualizations')
        )
      )
    ),
    
    selectedModel && React.createElement(
      'div',
      { className: 'mt-8 p-4 bg-blue-50 rounded-md' },
      React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'Selected Values:'),
      React.createElement('p', null, 'First Hit Pattern: ', selectedModel || 'None'),
      React.createElement('p', null, 'First Hit Time: ', selectedHighLow || 'None'),
      showColorSelection && React.createElement('p', null, 'Color: ', selectedColor || 'None'),
      showPercentage && React.createElement('p', null, 'Percentage: ', selectedPercentage || 'None')
    ),

    React.createElement(
      'div',
      { className: 'mt-8 p-4 bg-gray-50 rounded-md' },
      React.createElement('h2', { className: 'font-semibold mb-4 text-gray-700' }, 'Google Sheets API Connection'),
      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4' },
        React.createElement(
          'div',
          null,
          React.createElement('label', { htmlFor: 'api-key', className: 'block text-sm font-medium text-gray-700 mb-1' }, 'API Key'),
          React.createElement('input', {
            id: 'api-key',
            type: 'text',
            placeholder: 'Enter your Google API Key',
            className: 'w-full p-2 border border-gray-300 rounded-md',
            value: apiKey,
            onChange: e => setApiKey(e.target.value)
          })
        ),
        React.createElement(
          'div',
          null,
          React.createElement('label', { htmlFor: 'spreadsheet-id', className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Spreadsheet ID'),
          React.createElement('input', {
            id: 'spreadsheet-id',
            type: 'text',
            placeholder: 'Enter your Spreadsheet ID',
            className: 'w-full p-2 border border-gray-300 rounded-md',
            value: spreadsheetId,
            onChange: e => setSpreadsheetId(e.target.value)
          }),
          React.createElement('p', { className: 'text-xs text-gray-500 mt-1' }, 'ID from your link: 1RLktcJRtgG2Hoszy8Z5Ur9OoVZP_ROxfIpAC6zRGE0Q')
        )
      ),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { htmlFor: 'sheet-name', className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Sheet Name'),
        React.createElement('input', {
          id: 'sheet-name',
          type: 'text',
          placeholder: 'e.g., DDR Modeling Raw',
          className: 'w-full p-2 border border-gray-300 rounded-md',
          value: sheetName,
          onChange: e => {
            setSheetName(e.target.value);
            setSheetRange(e.target.value + '!A1:Z1000');
          }
        }),
        React.createElement('p', { className: 'text-xs text-gray-500 mt-1' }, 'File name: DDR Modeling, Sheet name: DDR Modeling Raw')
      ),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { htmlFor: 'sheet-range', className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Sheet Range (optional)'),
        React.createElement('input', {
          id: 'sheet-range',
          type: 'text',
          placeholder: 'e.g., DDR Modeling Raw!A1:Z1000',
          className: 'w-full p-2 border border-gray-300 rounded-md',
          value: sheetRange,
          onChange: e => setSheetRange(e.target.value)
        })
      ),
      React.createElement(
        'div',
        { className: 'flex justify-end' },
        React.createElement(
          'button',
          {
            className: 'bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md',
            onClick: () => fetchGoogleSheetsAPI(apiKey, spreadsheetId, sheetRange),
            disabled: !apiKey || !spreadsheetId
          },
          'Connect'
        )
      ),
      React.createElement('p', { className: 'mt-2 text-sm text-gray-500' }, 'Important: Make sure your Google Sheet is shared with the appropriate permissions.', React.createElement('br'), 'For API access, set the sheet to "Anyone with the link can view" or more permissive.')
    ),

    probabilityStats && probabilityStats.firstHitStats && probabilityStats.secondHitStats && React.createElement(
      'div',
      { className: 'mt-6' },
      React.createElement('h2', { className: 'font-semibold mb-4 text-gray-800 text-xl' }, 'Event Timing Analysis'),
      React.createElement(
        'div',
        { className: 'mb-6 p-4 bg-blue-50 rounded-lg' },
        React.createElement('h3', { className: 'font-medium text-gray-700 mb-2' }, 'First Hit Timing'),
        React.createElement('p', null, 'Median Time: ', probabilityStats.firstHitStats.median || 'N/A'),
        React.createElement('p', null, '70th Percentile: ', probabilityStats.firstHitStats.percentile70 || 'N/A'),
        React.createElement('div', { className: 'mt-4 h-64' }, React.createElement('canvas', { id: 'firstHitChart', className: 'w-full h-full' }))
      ),
      React.createElement(
        'div',
        { className: 'mb-6 p-4 bg-green-50 rounded-lg' },
        React.createElement('h3', { className: 'font-medium text-gray-700 mb-2' }, 'Second Hit Timing'),
        React.createElement('p', null, 'Median Time: ', probabilityStats.secondHitStats.median || 'N/A'),
        React.createElement('p', null, '70th Percentile: ', probabilityStats.secondHitStats.percentile70 || 'N/A'),
        React.createElement('div', { className: 'mt-4 h-64' }, React.createElement('canvas', { id: 'secondHitChart', className: 'w-full h-full' }))
      )
    )
  );
};

React.useEffect(() => {
  if (probabilityStats && probabilityStats.firstHitStats && probabilityStats.secondHitStats) {
    const ctx1 = document.getElementById('firstHitChart').getContext('2d');
    const ctx2 = document.getElementById('secondHitChart').getContext('2d');

    if (window.firstHitChart) window.firstHitChart.destroy();
    if (window.secondHitChart) window.secondHitChart.destroy();

    window.firstHitChart = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: Object.keys(probabilityStats.firstHitStats.counts),
        datasets: [{
          label: 'Occurrences',
          data: Object.values(probabilityStats.firstHitStats.counts),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          x: { title: { display: true, text: 'Time' } },
          y: { title: { display: true, text: 'Occurrences' }, beginAtZero: true }
        },
        plugins: {
          annotation: {
            annotations: [
              {
                type: 'line',
                xMin: probabilityStats.firstHitStats.median,
                xMax: probabilityStats.firstHitStats.median,
                borderColor: 'white',
                borderWidth: 2
              },
              {
                type: 'line',
                xMin: probabilityStats.firstHitStats.percentile70,
                xMax: probabilityStats.firstHitStats.percentile70,
                borderColor: 'blue',
                borderWidth: 2
              }
            ]
          }
        }
      }
    });

    window.secondHitChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: Object.keys(probabilityStats.secondHitStats.counts),
        datasets: [{
          label: 'Occurrences',
          data: Object.values(probabilityStats.secondHitStats.counts),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          x: { title: { display: true, text: 'Time' } },
          y: { title: { display: true, text: 'Occurrences' }, beginAtZero: true }
        },
        plugins: {
          annotation: {
            annotations: [
              {
                type: 'line',
                xMin: probabilityStats.secondHitStats.median,
                xMax: probabilityStats.secondHitStats.median,
                borderColor: 'white',
                borderWidth: 2
              },
              {
                type: 'line',
                xMin: probabilityStats.secondHitStats.percentile70,
                xMax: probabilityStats.secondHitStats.percentile70,
                borderColor: 'blue',
                borderWidth: 2
              }
            ]
          }
        }
      }
    });
  }
}, [probabilityStats]);

// Render the React component to the DOM
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(DDRDashboard));
