import { useState } from 'react'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            Lecture to Notes
          </h1>
          <p className="text-xl text-gray-600">
            Transform your lecture recordings into organized notes with AI
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center py-12">
              <div className="mb-6">
                <svg
                  className="mx-auto h-24 w-24 text-indigo-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">
                Welcome to Lecture to Notes
              </h2>
              <p className="text-gray-600">
                Upload your lecture recordings and let AI create structured notes for you
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
