const skills = [
    {name : "HTML" , proficiency : "Intermediate"},
    {name : "CSS" , proficiency : "Intermediate"},
    {name : "JavaScript" , proficiency : "Beginner"}
];

const output = skills.map(skills=> `${skills.name} (${skills.proficiency})`);
console.log(output);
