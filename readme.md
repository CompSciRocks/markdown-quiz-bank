# JavaScript Markdown Quizzes

**Note:** This is not ready for use. 

## Why?
We're using Canvas at my school, and while it's great for a number of things it's not
quick and easy to build up question banks. Especially those where the fonts need a lot
of formatting. Entering code samples is at best tedious. 

For assessments, it's good enough because I'm not loading a bunch of questions. But for 
worksheets and practice it was keeping me from making large banks where students could
go for practice. And, since I don't generally take grades on worksheets I didn't need
to worry about having something that Canvas could grade. I just wanted somewhere that
my students could go and practice and tell immediately if they're correct.

And, I needed an excuse to do a project in vanilla JavaScript. It's been a while since
I've built something in JS that didn't depend on jQuery. 

### Why Markdown?
I type a lot in markdown, and it's my preference. Probably not everybody's thing, but 
it works really well for me. If you're a markdown person, it may work well for you too.

The script is using the Marked parser along with a few extension to get everthing looking
like it should. More on that below. 

## Usage

## Config Format
```javascript
var config = {
    
    // Max number of files to use, will be random
    count: 5, 

    // Element to insert questions into, defaults to body
    // if this is left off 
    parent: 'elementId',

    // Customized language strings
    lang: {
        check: 'Check',             // Check button text
        correct: 'Correct',         // Label for a question that's checked and correct
        incorrect: 'Incorrect',     // Label for a question that's checked and incorrect
    },

    // List of files to use for bank. Can be either relative to the file where this
    // is called or full URLs. 
    questions: [
        'q1.md', 
        'q2.md', 
        'q3.md',
    ],

    // Styling to use. For now it's either bootstrap5 or none which will only use style
    // names namespaced to this project - "mdq-question", that sort of thing
    style: 'bootstrap5',
}
```