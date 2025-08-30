module.exports = {
    transform: {
        '^.+\\.jsx?$': ['babel-jest', { 
            configFile: './babel.config.js' // explicitly specify Babel config file
        }]
    },
    testEnvironment: 'jsdom',
    moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
};