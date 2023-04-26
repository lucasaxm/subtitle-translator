import fs from 'fs'
import colors from 'colors'
import {Configuration, OpenAIApi} from 'openai'
import {parseSync, stringifySync} from 'subtitle'
import {compile, decompile} from "ass-compiler";

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))

const configuration = new Configuration({
  apiKey: config.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

let subtitles = fs.readdirSync('./src')
let supportExtensions = ['srt', 'vtt', 'ass']

async function translate(previousSubtitles, input) {
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `You are a program responsible for translating subtitles. Your task is to output the specified target language based on the input text. Please do not create the following subtitles on your own. Please do not output any text other than the translation. You will receive the subtitles in JSON format, the Input property needs needs to be translated, the previous translation results and next subtitle should be user only as context. Your reply should have the same JSON schema as the JSON you received. If you need to merge the subtitles with the following line, simply repeat the translation. Please transliterate the person's name into the local language. Target language: ${config.TARGET_LANGUAGE}`
      },
      ...previousSubtitles.slice(-4),
      {
        role: "user",
        content: JSON.stringify(input)
      }
    ],
  });
  let result = completion.data.choices[0].message.content
  try {
    let parsed = JSON.parse(result)
    result = parsed.Input
    if (result === undefined) {
      result = parsed.Output
    }
    if (result === undefined) {
      throw "Result format invalid"
    }
  } catch (e) {
    let match_result = result.match(/"Input":"(.*?)",/)
    if (match_result === null) {
      match_result = result.match(/"Output":"(.*?)",/)
    }
    if (match_result === null) {
      console.log('###'.red)
      console.log(e.toString().red)
      console.log(result?.red)
      console.log('###'.red)
    }
  }
  return result;
}

async function convertStr(subtitle) {
  let previousSubtitles = []

  for (let i = 0; i < subtitle.length; i++) {
    let text = subtitle[i].data.text
    let input = {Input: text}
    if (subtitle[i + 1]) {
      input.Next = subtitle[i + 1].data.text
    }
    let result = await translate(previousSubtitles, input);
    previousSubtitles.push({role: "user", content: JSON.stringify(input)})
    previousSubtitles.push({role: 'assistant', content: JSON.stringify({...input, Input: result})})
    // console.log(`${subtitle[i].data.text}`.blue)
    subtitle[i].data.text = `${result}\n${text}`
    console.log(`-----------------`.gray)
    console.log(`${i + 1} / ${subtitle.length}`.gray)
    console.log(`${result}`.green)
    console.log(`${text}`.white)
  }
}

async function convertAss(subtitle) {
  let previousSubtitles = []

  for (let i = 0; i < subtitle.dialogues.length; i++) {
    let text = subtitle.dialogues[i].slices[0].fragments[0].text
    let input = {Input: text}
    if (subtitle.dialogues[i + 1]) {
      input.Next = subtitle.dialogues[i + 1].slices[0].fragments[0].text
    }
    let result = await translate(previousSubtitles, input);
    previousSubtitles.push({role: "user", content: JSON.stringify(input)})
    previousSubtitles.push({role: 'assistant', content: JSON.stringify({...input, Input: result})})

    subtitle.dialogues[i].slices[0].fragments[0].text = `${result}`
    console.log(`-----------------`.gray)
    console.log(`${i + 1} / ${subtitle.dialogues.length}`.gray)
    console.log(`${result}`.green)
    console.log(`${text}`.white)
  }
}

for (let subtitleFile of subtitles) {
  const ext = subtitleFile.split('.').pop();
  if (!supportExtensions.includes(ext)) continue
  const isAss = (ext === 'ass');
  let subtitle = fs.readFileSync(`./src/${subtitleFile}`, 'utf8')
  if (isAss) {
    subtitle = compile(subtitle)
    await convertAss(subtitle);
    fs.writeFileSync(`./res/${subtitleFile}`, decompile(subtitle))
  } else {
    subtitle = parseSync(subtitle)
    subtitle = subtitle.filter(line => line.type === 'cue')
    await convertStr(subtitle);
    fs.writeFileSync(`./res/${subtitleFile}`, stringifySync(subtitle, {format: 'srt'}))
  }

}