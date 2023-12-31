const db = require('../db')
const { hash, genSalt } = require('bcryptjs')
const dom = require('react-router-dom')
const saltRounds = 10

const getCurrent = async () => {
  try{
    var result = await db.query('select * from section order by year desc,case when semester = \'Spring\' then 1 when semester = \'Summer\' then 2 when semester = \'Fall\' then 3 else 4 end desc limit 1')
    // console.log(result)
    return result.rows[0]
  } catch (error) {
    console.log(error.message)
  }
}


exports.getUsers = async (req, res) => {
  try {
    const { rows } = await db.query('select ID, name from student')

    return res.status(200).json({
      success: true,
      users: rows,
    })
  } catch (error) {
    console.log(error.message)
  }
}

exports.set_pass = async (req, res) => {
  const { user_id, password } = req.body
  try {
    const salt = await genSalt(saltRounds)
    const hashedPassword = await hash(password, salt)

    await db.query('insert into user_password(id,hashed_password) values ($1 , $2)', [
      user_id,
      hashedPassword,
    ])

    return res.status(201).json({
      success: true,
      message: 'Password set was successfull',
    })
  } catch (error) {
    console.log(error.message)
    return res.status(500).json({
      error: error.message,
    })
  }
}

exports.login = async (req, res) => {
  let user = req.user

  console.log("IN LOGIN VALIDATOR")
  console.log(user)
  console.log("IN LOGIN VALIDATOR")

  let payload = {
    id: user.id,
    password: user.hashed_password,
  }

  // console.log(payload)

  try {
    req.session.loggedin = true
    req.session.user_id = user.id
    // console.log(req.session)
    return res.status(200).json({
      success: true,
      message: 'Logged in succefully',
    })
  } catch (error) {
    console.log(error.message)
    return res.status(500).json({
      error: error.message,
    })
  }
}

exports.dropcourse = async (req, res) => {
  try{
    let course = req.body
    await db.query('delete from takes where ID = $1 and course_id = $2 and semester = $3 and year = $4',[
      course.id, course.course_id, course.semester, course.year
    ])

    return res.status(200)
  } catch (error) {
    console.log(error.message)
  }

}

exports.runningdept = async (req, res) => {
  try {
    const cur = await getCurrent()
    const cur_sem = cur.semester
    const cur_year = cur.year
    var result = await db.query('select distinct dept_name from section natural join course where year = $1 and semester = $2',[cur_year, cur_sem])
    // console.log(result.rows)
    let payload = {
      depts: result.rows
    }

    return res.status(200).end(JSON.stringify(payload))
  } catch (error) {
    console.log(error.message)
  }
}

exports.runningdeptcourses = async (req, res) => {
  try {
    const cur = await getCurrent()
    const cur_sem = cur.semester
    const cur_year = cur.year
    var dept = "%"
    dept = dept.concat(req.originalUrl.split("/")[3].split("%")[0],"%")
    var result = await db.query('select distinct course_id, title from section natural join course where year = $1 and semester = $2 and dept_name ilike $3',[cur_year, cur_sem, dept])
    // console.log(result.rows)
    let payload = {
      courses: result.rows
    }

    return res.status(200).end(JSON.stringify(payload))
  } catch (error) {
    console.log(error.message)
  }
}

exports.getcourse = async (req, res) => {
  try {
    const cur = await getCurrent()
    const cur_sem = cur.semester
    const cur_year = cur.year
    var course_id = req.originalUrl.split("/")[2]
    var result = await db.query('select * from course where course_id = $1',[course_id])
    var result2 = await db.query('select prereq.prereq_id, title from prereq,course where prereq_id = course.course_id and prereq.course_id = $1',[course_id])
    var result3 = await db.query('select distinct id,name from teaches natural join instructor where year = $1 and semester = $2 and course_id = $3',[cur_year, cur_sem, course_id])
    // console.log(result.rows)
    let payload = {
      about: result.rows[0],
      prereq: result2.rows,
      instructors: result3.rows
    }

    return res.status(200).end(JSON.stringify(payload))
  } catch (error) {
    console.log(error.message)
  }
}

exports.getinstructor = async (req, res) => {
  try {
    const cur = await getCurrent()
    const cur_sem = cur.semester
    const cur_year = cur.year
    var id = req.originalUrl.split("/")[3]
    var result = await db.query('select name, dept_name from instructor where id = $1',[id])
    var result2 = await db.query('select course_id, title from teaches natural join course where year = $1 and semester = $2 and ID = $3 order by course_id asc',[cur_year, cur_sem, id])
    var result3 = await db.query('select id, course_id, title, year, semester from teaches natural join course where id = $3 and (year < $1 or (year = $1 and semester != $2)) order by year desc, case when semester = \'Spring\' then 1 when semester = \'Summer\' then 2  when semester = \'Fall\' then 3 when semester = \'Winter\' then 4 end desc',[cur_year, cur_sem, id])
    // console.log(result.rows)
    let payload = {
      about: result.rows[0],
      cur_courses: result2.rows,
      past_courses: result3.rows
    }

    return res.status(200).end(JSON.stringify(payload))
  } catch (error) {
    console.log(error.message)
  }
}

exports.registration = async (req, res) => {
  try {
    const cur = await getCurrent()
    const cur_sem = cur.semester
    const cur_year = cur.year
    var result = await db.query('select * from student where ID = $1',[req.user.id])
    var result2 = await db.query('select * from takes where ID = $1 and ( year < $2 or (year = $2 and semester < $3))  ORDER BY year desc, semester desc',[req.user.id, cur_year, cur_sem])
    var result3 = await db.query('select course_id from takes where ID = $1 and year = $2 and semester = $3',[req.user.id, cur_year, cur_sem])
    var result4 = await db.query(' select course_id, title, array_agg(sec_id) as sec_id from section natural join course where course_id not in (select course_id from takes where ID = $1 and year = $2 and semester = $3) and year=$2 and semester=$3 group by course_id,title',[req.user.id,cur_year,cur_sem])
    console.log(result3.rows)
    console.log(result4.rows)
    
    let payload = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      dept_name: result.rows[0].dept_name,
      tot_cred: result.rows[0].tot_cred,
      cur_courses: result3.rows,
      courses: result2.rows,
      cur_year: cur_year,
      cur_sem: cur_sem,
      all_run_courses: result4.rows,
      all_search_courses: result4.rows
    }

    return res.status(200).end(JSON.stringify(payload))
  } catch (error) {
    console.log(error.message)
  }
}

exports.registerForCourse = async (req, res) => {
  var { id, course_id, sec_id, title } = req.body
  try {
    const cur = await getCurrent()
    const cur_sem = cur.semester
    const cur_year = cur.year
    
    const grade=null

    await db.query('Insert into takes(ID,course_id,sec_id,semester,year,grade) values($1,$2,$3,$4,$5,$6)',[id,course_id,sec_id,cur_sem,cur_year,grade])

    return res.status(201).json({
      success: true,
      message: 'Registration was successfull',
    })
  } catch (error) {
    console.log(error.message)
    return res.status(500).json({
      error: error.message,
    })
  }
}



exports.protected = async (req, res) => {
  try {
    const cur = await getCurrent()
    const cur_sem = cur.semester
    const cur_year = cur.year
    var result = await db.query('select * from student where ID = $1',[req.user.id])
    var result3 = await db.query('select * from takes natural join course where ID = $1 and year = $2 and semester = $3',[req.user.id, cur_year, cur_sem])
    var result4 = await db.query('select year,semester, array_agg(id||\',\'||course_id||\',\'||title||\',\'||sec_id||\',\'||grade ) as rows from takes natural join course where ID=$1 and (year<$2 or (year=$2 and semester!=$3)) group by year,semester order by year desc,case when semester=\'Spring\' then 1 when semester=\'Summer\' then 2 when semester=\'Fall\' then 3 else 4 end desc ',[req.user.id,cur_year,cur_sem])

    console.log(result4.rows)
    
    let payload = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      dept_name: result.rows[0].dept_name,
      tot_cred: result.rows[0].tot_cred,
      cur_courses: result3.rows,
      courses: result4.rows,
      cur_year: cur_year,
      cur_sem: cur_sem
    }

    return res.status(200).end(JSON.stringify(payload))
  } catch (error) {
    console.log(error.message)
  }
}

exports.logout = async (req, res) => {
  try {
    if(req.session.loggedin){
      req.session.loggedin = false
      req.session.destroy();
      res.status(200).json({
        success: true,
        message: 'Logged out succefully',
      })
    }
    else{
        res.send('already logged out ')
    }
  } catch (error) {
    console.log(error.message)
    return res.status(500).json({
      error: error.message,
    })
  }
}
