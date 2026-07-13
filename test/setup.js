// 仅 Node 自动化测试允许使用 __testOpenid；微信云函数生产环境不设置这两个变量。
process.env.NODE_ENV = 'test';
process.env.ENERGY_TREE_ALLOW_TEST_AUTH = '1';
