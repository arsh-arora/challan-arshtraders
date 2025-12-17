export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Welcome to Challan Tracker</h1>
        <p className="text-gray-600 mt-2">Manage your inventory and track documents efficiently</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <a
          href="/upload"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-500"
        >
          <div className="flex items-center mb-3">
            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload Challan</h3>
          <p className="text-sm text-gray-600">Import Excel files to create new challans and inventory</p>
        </a>

        <a
          href="/document/new"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-transparent hover:border-green-500"
        >
          <div className="flex items-center mb-3">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Create Document</h3>
          <p className="text-sm text-gray-600">Create inbound, outbound, or return documents</p>
        </a>

        <a
          href="/inventory"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-transparent hover:border-purple-500"
        >
          <div className="flex items-center mb-3">
            <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Inventory</h3>
          <p className="text-sm text-gray-600">View and search all inventory items and their status</p>
        </a>

        <a
          href="/tickets"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-transparent hover:border-indigo-500"
        >
          <div className="flex items-center mb-3">
            <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Tickets</h3>
          <p className="text-sm text-gray-600">Track sub-batch items by ticket code</p>
        </a>

        <a
          href="/outstanding"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-transparent hover:border-yellow-500"
        >
          <div className="flex items-center mb-3">
            <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Outstanding</h3>
          <p className="text-sm text-gray-600">View items not yet returned to suppliers</p>
        </a>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Getting Started</h2>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li>Upload an Excel challan file to import items and create inventory</li>
          <li>View your inventory to see all items at different locations</li>
          <li>Create documents to move items between locations</li>
          <li>Track outstanding items that need to be returned to suppliers</li>
          <li>Use tickets to track specific sub-batches of items</li>
        </ol>
      </div>
    </div>
  );
}
