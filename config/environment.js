function normalizeNodeEnv(value) {
  const env = String(value || '').trim().toLowerCase();
  if (env === 'prod' || env === 'production') return 'production';
  if (env === 'stage' || env === 'staging') return 'staging';
  if (env === 'dev' || env === 'development' || env === '') return 'development';
  return env;
}

const nodeEnv = normalizeNodeEnv(process.env.NODE_ENV);
const isProduction = nodeEnv === 'production';
const isStaging = nodeEnv === 'staging';
const isDevelopment = nodeEnv === 'development';

module.exports = {
  nodeEnv,
  isProduction,
  isStaging,
  isDevelopment,
  normalizeNodeEnv
};
