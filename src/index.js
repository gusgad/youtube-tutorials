import express from 'express'
import thunderingHerdRouter from './routes/thunderingHerd.js'
import penetrationRouter from './routes/penetration.js'
import breakdownRouter from './routes/breakdown.js'
import avalancheRouter from './routes/avalanche.js'
import hotkeyRouter from './routes/hotkey.js'

const app = express()
app.use(express.json())

app.use('/thundering-herd', thunderingHerdRouter)
app.use('/penetration',     penetrationRouter)
app.use('/breakdown',       breakdownRouter)
app.use('/avalanche',       avalancheRouter)
app.use('/hotkey',          hotkeyRouter)

app.listen(3000, () => console.log('Demo running on http://localhost:3000'))
