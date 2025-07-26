import React from 'react';
import { Link } from 'react-router-dom';

const AboutPage: React.FC = () => {
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
          About BikesForCities
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="prose max-w-none">
            <p className="text-lg text-gray-600 mb-6">
              BikesForCities is a comprehensive platform for analyzing and visualizing 
              bike-sharing data across urban environments. Our mission is to provide 
              insights into urban mobility patterns and help cities optimize their 
              bike-sharing infrastructure.
            </p>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Features
            </h2>
            
            <ul className="list-disc list-inside space-y-2 text-gray-600 mb-6">
              <li>Interactive network visualization</li>
              <li>City-to-city comparison tools</li>
              <li>Route analysis and optimization</li>
              <li>Real-time data integration</li>
              <li>Comprehensive analytics dashboard</li>
            </ul>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Technology Stack
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Frontend</h3>
                <ul className="list-disc list-inside text-gray-600">
                  <li>React with TypeScript</li>
                  <li>Tailwind CSS for styling</li>
                  <li>React Router for navigation</li>
                  <li>React Query for data fetching</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Backend</h3>
                <ul className="list-disc list-inside text-gray-600">
                  <li>FastAPI (Python)</li>
                  <li>PostgreSQL with PostGIS</li>
                  <li>Docker for containerization</li>
                  <li>OSMnx for network analysis</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Get Started
              </h3>
              <p className="text-blue-700 mb-4">
                Ready to explore bike-sharing networks? Start by exploring the map 
                or comparing different cities.
              </p>
              <div className="flex gap-4">
                <Link
                  to="/map"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Explore Map
                </Link>
                <Link
                  to="/compare"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Compare Cities
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage; 