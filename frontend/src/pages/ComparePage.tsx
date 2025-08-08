import React from 'react';
import { Link } from 'react-router';

const ComparePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            to="/"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Home
          </Link>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Compare Cities
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 mb-4">
            Compare bike-sharing networks across different cities. Analyze metrics, 
            network density, and usage patterns.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Select City 1
              </h3>
              <p className="text-gray-500">Choose a city to compare</p>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Select City 2
              </h3>
              <p className="text-gray-500">Choose another city to compare</p>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
              Compare Networks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparePage; 