
import zxcvbn from 'zxcvbn';
console.log('brandNewPass456:', zxcvbn('brandNewPass456').score);
console.log('brandNewPass456:', zxcvbn('brandNewPass456').feedback.warning);
console.log('brandNewPass456:', zxcvbn('brandNewPass456').feedback.suggestions);
