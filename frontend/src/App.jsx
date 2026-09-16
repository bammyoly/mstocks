import React from "react"
import Navbar from "./components/Navbar"
import RouterConfig from "./routes/RouterConfig"
import Footer from "./components/Footer"
import { Toaster } from "react-hot-toast"

function App() {

  return (
    <div>
      <Navbar />
      <RouterConfig />
      {/* NEO-BRUTALIST TOAST CONFIGURATION */}
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: '0px',
              border: '2px solid #FFFFFF',
              background: '#1A1A22',
              color: '#FFFFFF',
              fontFamily: 'monospace',
              fontWeight: '900',
              textTransform: 'uppercase',
              fontSize: '12px',
              boxShadow: '4px 4px 0px 0px #A855F7',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#0A0A0C' },
              style: { boxShadow: '4px 4px 0px 0px #10B981' }
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#FFFFFF' },
              style: { boxShadow: '4px 4px 0px 0px #EF4444' }
            },
          }}
        />
      <Footer />
    </div>
  )
}

export default App
