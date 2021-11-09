# JavaScript Markdown Quizzes

JavaScript Markdown Quizzes is a drop in JavaScript file that you can use to create online quizzes and worksheets, backed by a question bank of markdown files. 

## Why?
We're using Canvas at my school, and while it's great for a number of things it's not quick and easy to build up question banks. Especially those where the fonts need a lot of formatting. Entering code samples is at best tedious. 

For assessments, it's good enough because I'm not loading a bunch of questions. But for worksheets and practice it was keeping me from making large banks where students could go for practice. And, since I don't generally take grades on worksheets I didn't need to worry about having something that Canvas could grade. I just wanted somewhere that my students could go and practice and tell immediately if they're correct.

And, I needed an excuse to do a project in vanilla JavaScript. It's been a while since I've built something in JS that didn't depend on jQuery. 

### Why Markdown?
I type a lot in markdown, and it's my preference. Probably not everybody's thing, but it works really well for me. If you're a markdown person, it may work well for you too.

The script is using the Marked parser along with a few extension to get everything looking like it should. More on that below. 

## Creating Questions

All questions are simple markdown files with a bit of front matter to tell the script what it needs to know to grade. At a minimum, the front matter needs to include the question type. The question might also require the correct answer in the front matter.

The front matter would look something like this

```markdown
---
title: An optional title for the question
type: Question type - Can be MC, TF or FIB
answer: Correct answer for MC or TF questions
---
```

So, let's say we want a multiple choice question. It would look like this.

```markdown
---
title: My first multiple choice question
type: MC
answer: A
---
```

All questions share the following properties in front matter. Some question types may have additional options.

| Property | Notes                                                        |
| -------- | ------------------------------------------------------------ |
| title    | The name of the question. This is optional and currently not used, but may be in the future. |
| type     | The type of question - either MC (multiple choice), TF (true / false), or FIB (fill in the blank). This is the only required field. |

You can also add additional properties if it helps keep you organized. Anything not listed will be ignored. 

### Question Types

#### Multiple Choice

Going to start with this one since it's probably the one you'll use most often.  Multiple choice questions have a type of either MC or Multiple Choice. 

| Property | Notes                                                        |
| -------- | ------------------------------------------------------------ |
| type     | MC                                                           |
| answer   | The correct answer for the question. Answers are listed in the file after the `---answers` header and the value for this property matches the answers in the order listed. It can either be a letter - A-Z - or a number. |
| shuffle  | If true, the answers will be shuffled when displayed. Defaults to true. |



```
---
title: A multiple choice question
type: MC
answer: A
shuffle: True
---

Which one of these is the biggest number?

---answers
100
---
25
---
60
---
-5

```

This question will have 4 options - 100, 25, 60, & -5. 100 is the correct answer. And the answers will be shuffled when shown to students. 

Note the `---answers` section break. The answers are listed below that heading and separated by `---` (3 dashes). 

### True / False

```
---
type: TF
answer: T
---

The sky is blue
```

True / false questions are the simplest type. The only required front matter fields are `type` and `answer`. And strictly speaking, even the `answer` is optional. It'll default to `true` if you leave it off.

### Fill in the blank

Fill in the blank questions are a little more complicated because you have to include the correct answers in the body of the question instead of the front matter. But, this does allow you more freedom when building the question.

```
---
type: FIB
---

My favorite color is ___(green)[]. 

Bob's favorite color is ___(Purple)[case sensitive: true, width 150px]

Pick your favorite color ___{Blue|+:Green|Yellow|Red}[]
```

There are two types of blanks you can use; a free entry field and a drop down with terms to select.

#### Blank Fields

For a free text entry field you'll use the format `___()[]`. That's 3 underscores followed by a matched set of parenthesis and then a matched set of square brackets. The format is important because it's how the script knows what to replace with a text field. 

Inside the parenthesis is the correct answer. In the first two examples above `green` and `Purple` are the correct answers. 

In the brackets you can add additional options, separated by commas. See the second example. It's a case sensitive match and the field will be 150 pixels wide.

| Option         | Notes                                                        |
| -------------- | ------------------------------------------------------------ |
| Case Sensitive | If true then matching will be done in a case sensitive manner. For the second example above, Purple is correct but purple would not be considered correct. For the first example, it is not case sensitive so green, Green, or GrEeN would all be counted correct. |
| contains       | If true then the answer must be contained in the answer. For the first example above, the answer must contain the word green. If false, or not used, it has to be an exact match. |
| regex          | If true, the entered value will be compared using the value inside the parenthesis as a regular expression. For example, you could put `/^\d{3}$/` inside the parenthesis and it would match any 3 digit number. |
| Width          | Width of the text field. Can be any unit that CSS understands - px, em, vw, etc. If you don't use this option the field is set to a default width. |

Contains and regex are mutually exclusive. If you use both, contains will be used. 

#### Dropdown Selection

The third example above is a drop down selection instead of a free text entry. Notice the `{}` instead of `()` surrounding the options. The format is `___{}[]`. 3 underscores, a matched set of curly braces, and a matched set of square brackets. 

Inside the braces you'll put the options. In the example above there are 4 options in the drop down; Blue, Green, Yellow, and Red. Each value is separated by a pipe character `|`. 

Note the `+:` in front of Green. That is used to mark the correct answer. 

Like blank fields, you can customize the dropdown using properties inside the [], although there's currently only one option for dropdowns.

| Option  | Notes                                                        |
| ------- | ------------------------------------------------------------ |
| shuffle | If true, the options will be shuffled. If false, the default, they will display in the order in the parenthesis. |

## Explanations

If you want to leave a bit of help for your students you can include an explanations section which starts with the header `---explanation`.

```
---
type: TF
answer: T
---
The sky is blue

---explanation
Yes, the sky is blue
```

If there is an explanation there will be a `Help` button next to the `Check` button for the question. After the student makes a selection and checks it the Help button is enabled. When clicked, it'll display the text you've entered under the explanation heading. 

## Installation 

Now that you have some files, it's time to build the HTML page for your quiz. 

```html
<!DOCTYPE html>
<html>
    <head>
        <title>A worksheet</title>
        <script src="https://scripts.compsci.rocks/quiz/latest/mdq.min.js"></script>
    </head>
    <body>        
    </body>
</html>
```

The link `https://scripts.compsci.rocks/quiz/latest/mdq.min.js` will pull the latest version from our CDN. You can also download the `mdq.min.js` file from the `dist` folder in this repo if you'd rather self host it. But feel free to use the CDN link. That way you'll always have the latest version. 

You'll also need to initialize the script. Somewhere in your file, probably towards the bottom, you're going to call the `init` function.

```html
<script>
	let config = {}; // more on this in a bit
	mdq.init(config);
</script>
```



### Config Format

You will need to create a config variable to pass to `init`. At minimum it needs to have the `questions` property shown below, which is an array of markdown files to load. The example below assumes `q1.md`, `q2.md` and `q3.md` are in the same folder as your HTML file; but you can load files from any publicly accessible location. 

```html
<script>
let config = {
    count: 5, 
    parent: 'elementId',
    lang: {
        check: 'Check',             // Check button text
        correct: 'Correct',         // Label for a question that's checked and correct
        incorrect: 'Incorrect',     // Label for a question that's checked and incorrect
    },
    questions: [
        'q1.md', 
        'q2.md', 
        'q3.md',
    ],
    style: 'bootstrap5',
};
mdq.init(config);
</script>
```

The config object can have the following properties. The only required property is `questions`. The others all have defaults that should work pretty well. 

| Property        | Default | Notes                                                        |
| --------------- | ------- | ------------------------------------------------------------ |
| count           | 5       | Maximum number of questions to load.                         |
| parent          | <none>  | The parent element to fill with the quiz. If blank, `document.body` is used. Can also be an element id. |
| questions       | []      | Array of question files to consider when displaying. These will be randomly loaded, up to the number set in `count`. They can be filenames if they're in the same folder as your HTML file or full URLs if they're located somewhere else. |
| style           | <none>  | Style to use when building the quiz. Currently, only `bootstrap5` is available. |
| css             | true    | If true, additional CSS will be inserted into the page to make the quiz look better. If false, it's not so you'll probably want to include the styles in your CSS files. |
| syntaxHighlight | true    | If true, and if you have code fences in your markdown then the PrismJS code highlighter will be added to the page and will syntax highlight code. |
| credit          | true    | If true, a link back to our site will be included at the bottom of the page. If false, then the link isn't displayed. |
| reload          | true    | If true, a reload button is added to the bottom of the quiz allows your students to get a fresh copy of the quiz without reloading the page. |
| stripRaw        | true    | Strip out `{% raw %}` and `{% endraw %}` tags. This is probably only necessary if you're using a static site builder to host your files. GitHub pages does need this, and there's a bit more on that below. |
| lang            |         | Language strings so you can customize to what you need. `correct`, `incorrect`, `check`, `help`, `true`, `false`, `reload` |



## GitHub Pages and Jekyll

If you're using GitHub Pages, or some other host that processes your markdown files before they go live you'll need to do a bit of a work around.

First step, instead of naming your question files with a `.md` extension, save them with a `.txt` extension. That way they'll get uploaded into your site. 

You're also going to want to add `{% raw %}` as the first line in your question file, before the front matter, and `{% endraw %}` as the last line. This will keep the markdown processor on GitHub Pages from stripping out pieces.