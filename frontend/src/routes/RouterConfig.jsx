import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from '../pages/Home'
import Trade from '../pages/Trade'
import Portfolio from '../pages/Portfolio'
import Faucet from '../pages/Faucet'

const RouterConfig = () => {
  return (
    <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/trade' element={<Trade />} />
        <Route path='/portfolio' element={<Portfolio />} />
        <Route path='/faucet' element={<Faucet />} />
    </Routes>
  )
}

export default RouterConfig