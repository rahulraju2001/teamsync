function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-6xl font-bold text-primary-600">
        404
      </h1>

      <p className="text-xl text-heading mt-3">
        Page Not Found
      </p>

      <p className="text-body mt-2">
        The page you're looking for doesn't exist.
      </p>
    </div>
  );
}

export default NotFound;