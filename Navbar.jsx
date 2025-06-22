function Navbar() {
  return (
    <nav className="bg-[#032541] border-b border-[#0f1c2d] px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
      <h1 className="text-2xl font-bold text-[#01b4e4]">CineShelf</h1>
      <ul className="flex space-x-6 text-gray-300 text-sm">
        <li className="hover:text-[#01b4e4] cursor-pointer transition duration-200">Home</li>
        <li className="hover:text-[#01b4e4] cursor-pointer transition duration-200">Reviews</li>
        <li className="hover:text-[#01b4e4] cursor-pointer transition duration-200">About</li>
      </ul>
    </nav>
  );
}
export default Navbar; 