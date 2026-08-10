
import zxcvbn from 'zxcvbn';
console.log('Password123!@:', zxcvbn('Password123!@').score);
console.log('Password123!@#:', zxcvbn('Password123!@#').score);
