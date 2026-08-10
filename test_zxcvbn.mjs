
import zxcvbn from 'zxcvbn';
console.log('Password123!:', zxcvbn('Password123!').score);
console.log('SecurePass456!:', zxcvbn('SecurePass456!').score);
console.log('OldPass1234!:', zxcvbn('OldPass1234!').score);
console.log('NewPass5678!:', zxcvbn('NewPass5678!').score);
console.log('SecurePass123!:', zxcvbn('SecurePass123!').score);
console.log('Password123!:', zxcvbn('Password123!').score);
console.log('SecurePass123!:', zxcvbn('SecurePass123!').score);
