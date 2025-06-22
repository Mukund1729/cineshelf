function BlogCard({ title, desc }) {
  return (
    <div className="bg-[#161b22] p-5 rounded-lg shadow-md hover:bg-[#1d2430] transition duration-300 text-white">
      <h3 className="text-cyan-400 text-lg font-bold">{title}</h3>
      <p className="text-gray-300 mt-2 text-sm">{desc}</p>
    </div>
  );
}
export default BlogCard;
