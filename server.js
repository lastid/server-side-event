const http = require('http')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

const PORT = 8080
const UPDATE_TIME_SECONDS = 3
// seems like we cannot add more symbols here, need an apikey
const SYMBOLS = ['MSFT', 'FB', 'AAPL']
const STOCK_DATA_URL = `https://www.alphavantage.co/query?function=BATCH_STOCK_QUOTES&symbols=${SYMBOLS.join(',')}&apikey=demo`
const DECIMAL_DIGITS = 4
// keep track of prices to simulate updates
let latestStockPrices

// Create basic server
http.createServer((request, response) => {
  const isServerSideEventRequest = request.headers.accept &&
    request.headers.accept === 'text/event-stream' &&
    /sse/.test(request.url)

  if (isServerSideEventRequest) {
    handleServerSideEvent(response)
  } else {
    // return the html file
    const filePath = path.join(__dirname, 'index.html')
    const readStream = fs.createReadStream(filePath)

    response.writeHead(200)
    readStream.pipe(response)
  }
}).listen(PORT)

const handleServerSideEvent = (response) => {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  sendFirstPayload(response)

  // simulate update with realtime data
  setInterval(() => pushNewChange(response), UPDATE_TIME_SECONDS * 1000)
}

const sendFirstPayload = (response) => {
  fetch(STOCK_DATA_URL)
    .then(res => res.json())
    .then(stockData => {
      latestStockPrices = stockData['Stock Quotes'].map(
        stock => ({ symbol: stock['1. symbol'], price: stock['2. price'] })
      )

      writeMessage(response, {
        event: 'load',
        data: {
          stocks: latestStockPrices,
          graph: generateGraphData()
        }
      })
    })
    .catch(e => console.error(e))
}

const pushNewChange = (response) => {
  const symbolToUpdate = SYMBOLS[randomNumber(0, SYMBOLS.length - 1)]
  const stockToUpdate = latestStockPrices.find(({ symbol }) => symbol === symbolToUpdate)
  // change a random stock price with a random %
  const newPrice = parseFloat(stockToUpdate.price) * (1 + randomNumber(-10, 10) / 100)
  stockToUpdate.price = newPrice.toFixed(DECIMAL_DIGITS)

  writeMessage(response, {
    event: 'update',
    data: {
      // list of stocks to update, add more if needed
      stocks: [stockToUpdate],
      // one data point to add
      graph: { time: currentTime(), value: randomGraphValue() }
    }
  })
}

const writeMessage = (response, { event, data }) => {
  const id = currentTime()

  response.write(`id: ${id}\n`)
  response.write(`event: ${event}\n`)
  response.write(`data: ${JSON.stringify(data)}\n\n`)
}

const currentTime = () => (new Date()).toLocaleTimeString()
const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const randomGraphValue = () => randomNumber(60, 100)

// generate n data points in the past to show on a graph
const generateGraphData = () => [...Array(10)].map((_, index) => {
  const t = new Date()

  t.setSeconds(t.getSeconds() - index * UPDATE_TIME_SECONDS)

  return {
    time: t.toLocaleTimeString(),
    value: randomGraphValue()
  }
})
