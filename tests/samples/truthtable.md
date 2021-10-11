---
title: Truth table sample
type: fib
---

## Truth Table Example

Fill in the following truth table

<table class="table" style="width:auto;">
    <tr>
        <th>A</th>
        <th>B</th>
        <th>A && B</th>
    </tr>
    <tr>
        <td><code>True</code></td>
        <td><code>True</code></td>
        <td>___{+:True|False}[]</td>
    </tr>
    <tr>
        <td><code>True</code></td>
        <td><code>False</code></td>
        <td>___{True|+:False}[]</td>
    </tr>
    <tr>
        <td><code>False</code></td>
        <td><code>True</code></td>
        <td>___{True|+:False}[]</td>
    </tr>
    <tr>
        <td><code>False</code></td>
        <td><code>False</code></td>
        <td>___{True|+:False}[]</td>
    </tr>
</table>

---explanation
When two boolean values are separated by an and - <code>&&</code> - then both must
be `true` for the statement to be `true`. If either side is `false`, then the entire
statement is `false`.