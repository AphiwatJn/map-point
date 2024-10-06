import React from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { RouterProvider } from 'react-router-dom'
import Map from '../component/map.jsx'

const Layout = createBrowserRouter([
    {
        path : '/map-point',
        element : <Map/>
    }
])

export default function AppRouter() {
  return (
    <RouterProvider router={Layout}/>
  )
}
