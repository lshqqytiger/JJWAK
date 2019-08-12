import FS = require("fs");
import Express = require("express");

import { getProjectData, SETTINGS, PACKAGE, ENDPOINTS } from "./System";
import { L } from "./Language";

const HTML_TEMPLATE = getProjectData("template.html").toString();

const READER_TITLE = createReader("TITLE");
const READER_BODY = createReader("BODY");
const READER_STYLE = createReader("STYLE");
const READER_REACT_SUFFIX = createReader("REACT_SUFFIX");
const READER_LANGUAGE = createReader("LANGUAGE");
const READER_NEST = /("?)\/\*\{(.+?)\}\*\/\1/g;

function createReader(key:string):RegExp{
  return new RegExp(`("?)/\\* %%${key}%% \\*/\\1`, "g");
}
/**
 * 주어진 페이지를 렌더하는 Express 끝점 클로저를 반환한다.
 *
 * @param page 페이지.
 * @param data 추가 정보.
 */
export function PageBuilder<T extends JJWAK.Page.Type>(
  page:T,
  data?:JJWAK.Page.DataTable[T]
):Express.RequestHandler{
  return async (req, res) => {
    res.render(page, {
      locale: req.locale,
      page,
      path: req.originalUrl,
      data
    });
  };
}
/**
 * 주어진 파일에서 정의된 컴포넌트를 최상위 컴포넌트로 삼도록 한 HTML을 전달한다.
 *
 * HTML 내(JavaScript 포함)에서 `／*{...}*／` 구문은 이 함수 스코프 안에서 `eval(...)` 함수의 결과로 대체된다.
 *
 * @param path 뷰(React) 파일 경로.
 * @param $ Express 관련 추가 정보.
 * @param callback 콜백 함수.
 */
export function Engine<T extends JJWAK.Page.Type>(
  path:string,
  $:JJWAK.Page.Props<T>,
  callback:(err:any, content?:string) => void
):void{
  const REACT_SUFFIX = process.env['NODE_ENV'] === "production"
    ? "production.min"
    : "development"
  ;
  const KEY = `${$.locale}/${$.page}`;
  const LANGUAGE_TABLE_STRING = L(KEY);
  let jsData:string, cssData:string;

  $.title = L(`${KEY}#title`);
  $.version = PACKAGE['version'];

  // NOTE Express 내부적으로 정의한 정보가 외부에 노출되지 않도록 삭제
  delete ($ as any)['settings'];
  delete ($ as any)['cache'];
  delete ($ as any)['_locals'];

  try{
    jsData = FS.readFileSync(path).toString();
    cssData = FS.readFileSync(path.replace(/\.js$/, ".css")).toString();
  }catch(err){
    callback(err);
  }finally{
    const APP = {
      ...SETTINGS.application,
      'endpoints': ENDPOINTS[$.page],
      'false-if-front': false,
      'language-support': SETTINGS['language-support']
    };
    const HTML = HTML_TEMPLATE
      .replace(READER_REACT_SUFFIX, REACT_SUFFIX)
      .replace(READER_LANGUAGE, LANGUAGE_TABLE_STRING)
      .replace(READER_TITLE, $.title)
      .replace(READER_BODY, jsData)
      .replace(READER_STYLE, cssData.trim())
      .replace(READER_NEST, (v, p1, p2) => String(eval(p2)))
    ;
    // NOTE never used 오류 회피
    void APP;
    callback(null, HTML);
  }
}