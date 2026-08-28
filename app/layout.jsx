
import "./globals.css";

export const metadata = {
  title: "Horizon Innovations - Contract discussion",
  description: "Office Coordinator role"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="w-full bg-white shadow-sm py-4 px-6 text-center border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-800">Horizon Innovations - Contract discussion</h1>
          <p className="text-sm text-gray-500">Office Coordinator role</p>
        </div>
        <main className="flex justify-center p-6">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </body>
    </html>
  );
}
