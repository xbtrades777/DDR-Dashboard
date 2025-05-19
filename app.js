const DDRDashboard = React.createClass({
  getInitialState() {
    return {
      selectedModel: '',
      selectedHighLow: '',
      selectedColor: '',
      selectedPercentage: '',
      showPercentage: false,
      datasetCount: 0,
      isLoading: false,
      sheetData: [],
      error: null,
      probabilityStats: null,
      apiKey: 'AIzaSyBB5_LHGAX_tirA23TzDEesMJhm_Srrs9s',
      spreadsheetId: '1RLktcJRtgG2Hoszy8Z5Ur9OoVZP_ROxfIpAC6zRGE0Q',
      sheetName: 'DDR Modeling Raw',
      sheetRange: 'DDR Modeling Raw!A1:Z1000',
      showColorSelection: false
    };
  },

  componentDidMount() {
    if (this.state.apiKey && this.state.spreadsheetId) {
      this.fetchGoogleSheetsAPI(this.state.apiKey, this.state.spreadsheetId, this.state.sheetRange);
    }
  },

  componentDidUpdate(prevProps, prevState) {
    if (prevState.selectedModel !== this.state.selectedModel) {
      if (this.state.selectedModel === 'Min') {
        this.setState({ showPercentage: true, showColorSelection: false, selectedColor: '' });
      } else if (this.state.selectedModel) {
        this.setState({ showPercentage: false, showColorSelection: true, selectedPercentage: '' });
      } else {
        this.setState({ showPercentage: false, showColorSelection: false, selectedPercentage: '', selectedColor: '' });
      }
    }

    if (
      prevState.selectedModel !== this.state.selectedModel ||
      prevState.selectedHighLow !== this.state.selectedHighLow ||
      prevState.selectedColor !== this.state.selectedColor ||
      prevState.selectedPercentage !== this.state.selectedPercentage ||
      prevState.sheetData !== this.state.sheetData
    ) {
      this.updateDatasetCount();
    }
  },

  fetchGoogleSheetsAPI(apiKey, spreadsheetId, range) {
    this.setState({ isLoading: true, error: null });
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
    console.log('Attempting to fetch from:', url);
    
    fetch(url)
      .then(response => response.text())
      .then(responseText => {
        try {
          const data = JSON.parse(responseText);
          
          if (!data.values || data.values.length === 0) {
            this.setState({ error: 'No data found in the specified range', isLoading: false });
            return;
          }
          
          const headers = data.values[0];
          const rows = data.values.slice(1);
          
          const processedData = rows.map(row => {
            const item = {};
            headers.forEach((header, index) => {
              const key = header.toLowerCase().replace(/\s+/g, '_');
              item[key] = row[index] || null;
            });
            return item;
          });
          
          this.setState({ sheetData: processedData, isLoading: false }, this.updateDatasetCount);
        } catch (jsonError) {
          console.error('Response is not valid JSON:', responseText);
          this.setState({ error: 'Invalid API response: ' + responseText.substring(0, 100) + '...', isLoading: false });
        }
      })
      .catch(error => {
        console.error('Fetch error:', error);
        this.setState({ error: 'Error fetching data: ' + error.message, isLoading: false });
      });
  },

  updateDatasetCount() {
    if (!this.state.selectedModel || this.state.sheetData.length === 0) {
      this.setState({ datasetCount: 0, probabilityStats: null });
      return;
    }
    
    const matchingData = this.state.sheetData.filter(item => {
      const modelMatch = !this.state.selectedModel || (item.model && item.model.indexOf(this.state.selectedModel + ' -') === 0);
      const colorMatch = !this.state.selectedColor || item.outside_min_start === this.state.selectedColor;
      const percentageMatch = !this.state.selectedPercentage || (item['color_%'] === this.state.selectedPercentage);
      const highLowMatch = !this.state.selectedHighLow || item.first_hit_time === this.state.selectedHighLow;
      
      return modelMatch && colorMatch && percentageMatch && highLowMatch;
    });
    
    this.setState({ datasetCount: matchingData.length });
    
    if (matchingData.length > 0) {
      this.calculateProbabilities(matchingData);
    } else {
      this.setState({ probabilityStats: null });
    }
  },

  calculateProbabilities(filteredData) {
    const totalCount = filteredData.length;
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
    
    this.setState({
      probabilityStats: {
        totalCount,
        outcomeCounts,
        outcomePercentages,
        resultCounts,
        resultPercentages
      }
    });
  },

  handleModelChange(event) {
    this.setState({
      selectedModel: event.target.value,
      selectedHighLow: '',
      selectedColor: '',
      selectedPercentage: ''
    }, this.updateDatasetCount);
  },

  handleHighLowChange(event) {
    this.setState({ selectedHighLow: event.target.value }, this.updateDatasetCount);
  },

  handleColorChange(event) {
    this.setState({ selectedColor: event.target.value }, this.updateDatasetCount);
  },

  handlePercentageChange(event) {
    this.setState({ selectedPercentage: event.target.value }, this.updateDatasetCount);
  },

  render() {
    const allModels = ['Min', 'MinMed', 'MedMax', 'Max+', ''];
    const highLowOptions = ['Low ODR', 'High ODR', 'Low Trans', 'High Trans', 'Low RDR', 'High RDR'];
    const colorOptions = ['MinMed Green', 'MedMax Green', 'Max+ Green', 'MinMed Red', 'MedMax Red', 'Max+ Red'];
    const percentageOptions = ['Green 0 - 50%', 'Green 50 - 100%', 'Red 0 - 50%', 'Red 50 - 100%'];

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
              value: this.state.selectedModel,
              onChange: this.handleModelChange,
              className: 'w-full p-2 border border-gray-300 rounded-md'
            },
            React.createElement('option', { value: '' }, 'Select pattern'),
            allModels.map(model => React.createElement('option', { key: model, value: model }, model))
          )
        ),
        this.state.selectedModel && React.createElement(
          'div',
          { className: 'bg-gray-50 p-4 rounded-md' },
          React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'First Hit Time'),
          React.createElement(
            'select',
            {
              value: this.state.selectedHighLow,
              onChange: this.handleHighLowChange,
              className: 'w-full p-2 border border-gray-300 rounded-md'
            },
            React.createElement('option', { value: '' }, 'Select time'),
            highLowOptions.map(option => React.createElement('option', { key: option, value: option }, option))
          )
        ),
        this.state.showColorSelection && React.createElement(
          'div',
          { className: 'bg-gray-50 p-4 rounded-md' },
          React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'Color'),
          React.createElement(
            'select',
            {
              value: this.state.selectedColor,
              onChange: this.handleColorChange,
              className: 'w-full p-2 border border-gray-300 rounded-md'
            },
            React.createElement('option', { value: '' }, 'Select color'),
            colorOptions.map(color => React.createElement('option', { key: color, value: color }, color))
          )
        ),
        this.state.showPercentage && React.createElement(
          'div',
          { className: 'bg-gray-50 p-4 rounded-md' },
          React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, '% Color'),
          React.createElement(
            'select',
            {
              value: this.state.selectedPercentage,
              onChange: this.handlePercentageChange,
              className: 'w-full p-2 border border-gray-300 rounded-md'
            },
            React.createElement('option', { value: '' }, 'Select percentage'),
            percentageOptions.map(percentage => React.createElement('option', { key: percentage, value: percentage }, percentage))
          )
        )
      ),
      this.state.isLoading && React.createElement(
        'div',
        { className: 'mt-6 p-4 bg-yellow-50 rounded-md text-center' },
        React.createElement('p', { className: 'text-yellow-600' }, 'Loading data from Google Sheet...')
      ),
      this.state.error && React.createElement(
        'div',
        { className: 'mt-6 p-4 bg-red-50 rounded-md text-center' },
        React.createElement('p', { className: 'text-red-600' }, 'Error: ' + this.state.error)
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
            React.createElement('span', { className: 'text-2xl font-bold text-blue-600 mr-2' }, this.state.datasetCount),
            React.createElement('span', { className: 'text-gray-500 text-sm' }, 'records')
          )
        )
      ),
      this.state.probabilityStats && this.state.probabilityStats.outcomePercentages && React.createElement(
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
                React.createElement('p', { className: 'text-3xl font-bold text-purple-600' }, this.state.probabilityStats.outcomePercentages['Min'] + '%')
              ),
              React.createElement(
                'div',
                { className: 'h-12 w-12 bg-purple-200 rounded-full flex items-center justify-center' },
                React.createElement('span', { className: 'text-purple-700 text-xl' }, 'M')
              )
            ),
            React.createElement('p', { className: 'text-xs text-purple-700 mt-2' }, this.state.probabilityStats.outcomeCounts['Min'] + ' occurrences')
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
                React.createElement('p', { className: 'text-3xl font-bold text-indigo-600' }, this.state.probabilityStats.outcomePercentages['MinMed'] + '%')
              ),
              React.createElement(
                'div',
                { className: 'h-12 w-12 bg-indigo-200 rounded-full flex items-center justify-center' },
                React.createElement('span', { className: 'text-indigo-700 text-xl' }, 'MM')
              )
            ),
            React.createElement('p', { className: 'text-xs text-indigo-700 mt-2' }, this.state.probabilityStats.outcomeCounts['MinMed'] + ' occurrences')
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
                React.createElement('p', { className: 'text-3xl font-bold text-cyan-600' }, this.state.probabilityStats.outcomePercentages['MedMax'] + '%')
              ),
              React.createElement(
                'div',
                { className: 'h-12 w-12 bg-cyan-200 rounded-full flex items-center justify-center' },
                React.createElement('span', { className: 'text-cyan-700 text-xl' }, 'MX')
              )
            ),
            React.createElement('p', { className: 'text-xs text-cyan-700 mt-2' }, this.state.probabilityStats.outcomeCounts['MedMax'] + ' occurrences')
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
                React.createElement('p', { className: 'text-3xl font-bold text-amber-600' }, this.state.probabilityStats.outcomePercentages['Max+'] + '%')
              ),
              React.createElement(
                'div',
                { className: 'h-12 w-12 bg-amber-200 rounded-full flex items-center justify-center' },
                React.createElement('span', { className: 'text-amber-700 text-xl' }, 'M+')
              )
            ),
            React.createElement('p', { className: 'text-xs text-amber-700 mt-2' }, this.state.probabilityStats.outcomeCounts['Max+'] + ' occurrences')
          )
        )
      ),
      this.state.probabilityStats && this.state.probabilityStats.resultPercentages && React.createElement(
        'div',
        { className: 'mt-6' },
        React.createElement(
          'div',
          { className: 'bg-white p-4 rounded-lg shadow border border-gray-200' },
          React.createElement('h3', { className: 'font-medium text-gray-700 mb-3' }, 'Results Distribution'),
          React.createElement(
            'div',
            { className: 'space-y-3' },
            Object.keys(this.state.probabilityStats.resultPercentages).map(result => (
              React.createElement(
                'div',
                { key: result, className: 'space-y-1' },
                React.createElement(
                  'div',
                  { className: 'flex justify-between text-sm' },
                  React.createElement('span', { className: 'capitalize text-gray-600' }, result.replace(/_/g, ' ')),
                  React.createElement('span', { className: 'font-medium' }, this.state.probabilityStats.resultPercentages[result] + '%')
                ),
                React.createElement(
                  'div',
                  { className: 'w-full bg-gray-200 rounded-full h-2.5' },
                  React.createElement('div', {
                    className: 'h-2.5 rounded-full ' + (
                      result === 'win' ? 'bg-green-500' : 
                      result === 'loss' ? 'bg-red-500' : 'bg-blue-500'
                    ),
                    style: { width: this.state.probabilityStats.resultPercentages[result] + '%' }
                  })
                )
              )
            ))
          )
        )
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
              value: this.state.apiKey,
              onChange: e => this.setState({ apiKey: e.target.value })
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
              value: this.state.spreadsheetId,
              onChange: e => this.setState({ spreadsheetId: e.target.value })
            })
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
            value: this.state.sheetName,
            onChange: e => this.setState({ sheetName: e.target.value, sheetRange: e.target.value + '!A1:Z1000' })
          })
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
            value: this.state.sheetRange,
            onChange: e => this.setState({ sheetRange: e.target.value })
          })
        ),
        React.createElement(
          'div',
          { className: 'flex justify-end' },
          React.createElement(
            'button',
            {
              className: 'bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md',
              onClick: () => this.fetchGoogleSheetsAPI(this.state.apiKey, this.state.spreadsheetId, this.state.sheetRange),
              disabled: !this.state.apiKey || !this.state.spreadsheetId
            },
            'Connect'
          )
        )
      )
    );
  }
});

ReactDOM.render(React.createElement(DDRDashboard), document.getElementById('root'));
