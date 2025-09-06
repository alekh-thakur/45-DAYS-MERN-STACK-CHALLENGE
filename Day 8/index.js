const express = require('express');
const app = express();

const projects = [
    {id:1 , title:"E-commerce Platform" , Technologies: ['React','Node.js']},
    {id:2 , title:"Task Manager" , Technologies: ['Vue','React.js']}
];

const workExperience = [
{ id: 1, company: 'Tech Corp', position: 'Full Stack Developer' }
];

app.get('api/projects', (res,req)=>{
    res.json({success: true, count:projects.length, data : projects})
})

app.get('api/experience',(res,req)=>{
    res.json({success : true, count : workExperience.length, data : workExperience});

})

app.get('/api/projects/"id',(res,req)=>{
    const projectId = parseInt(req.params.id);
    const project = projects.find(p => p.id === projectId)
    if(!project){
        return res.status(404).json({
            success:false,
            error : 'Project not found'
            
        });
    }
    res.json({success:true , data : project})
});
const PORT = 3000;
app.listen(PORT, () => {
console.log(`Server running on http://localhost:${PORT}/api/projects`);
console.log(`Server running on http://localhost:${PORT}/api/experience`);
});