import React from 'react';
import { Link } from 'react-router-dom';

const MapPage: React.FC = () => {
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
          Interactive Map
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 mb-4">
            Explore bike-sharing networks and routes on an interactive map. 
            Visualize network density, popular routes, and station locations.
          </p>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Map Component
            </h3>
            <p className="text-gray-500 mb-4">
              Interactive map will be integrated here
            </p>
            <div className="flex gap-4 justify-center">
              <button className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                Load Madrid
              </button>
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                Load Barcelona
              </button>
            </div>
          </div>
          
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Network Stats</h4>
              <p className="text-blue-700 text-sm">View network statistics and metrics</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">Route Analysis</h4>
              <p className="text-green-700 text-sm">Analyze popular routes and patterns</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-2">Station Info</h4>
              <p className="text-purple-700 text-sm">Detailed station information</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapPage; 