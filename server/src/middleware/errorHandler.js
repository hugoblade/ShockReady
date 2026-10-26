const errorHandler = (error, _request, response, _next) => {
  console.error(error);

  response.status(error.status ?? 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message
  });
};

export default errorHandler;
